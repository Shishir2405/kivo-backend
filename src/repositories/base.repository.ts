import type {
  CollectionReference,
  DocumentData,
  Query,
  WhereFilterOp,
} from 'firebase-admin/firestore';

import { collection, FieldValue, getDb } from '@/firebase/firestore';
import type { BaseEntity, CreateInput, PaginatedResult, PaginationParams } from '@/types';
import { buildPaginatedResult } from '@/utils/pagination';
import { nowIso } from '@/utils/dates';

export interface QueryFilter {
  field: string;
  op: WhereFilterOp;
  value: unknown;
}

export interface FindOptions {
  filters?: QueryFilter[];
  orderBy?: { field: string; direction?: 'asc' | 'desc' };
  limit?: number;
}

/**
 * Generic Firestore repository providing typed CRUD + pagination for any
 * entity that extends {@link BaseEntity}. Domain repositories extend this and
 * add only their bespoke queries — keeping data access DRY and consistent.
 *
 * Responsibilities are strictly data-access: no business rules live here.
 */
export abstract class BaseRepository<T extends BaseEntity> {
  protected readonly collectionName: string;

  protected constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  protected get col(): CollectionReference<DocumentData> {
    return collection(this.collectionName);
  }

  /** Map a Firestore snapshot to a typed entity, injecting the document id. */
  protected fromDoc(
    snap: FirebaseFirestore.DocumentSnapshot<DocumentData>,
  ): T | null {
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<T, 'id'>) } as T;
  }

  async create(data: CreateInput<T>, id?: string): Promise<T> {
    const ts = nowIso();
    const ref = id ? this.col.doc(id) : this.col.doc();
    const payload = { ...data, createdAt: ts, updatedAt: ts } as DocumentData;
    await ref.set(payload);
    return { id: ref.id, ...payload } as T;
  }

  async findById(id: string): Promise<T | null> {
    const snap = await this.col.doc(id).get();
    return this.fromDoc(snap);
  }

  async exists(id: string): Promise<boolean> {
    const snap = await this.col.doc(id).get();
    return snap.exists;
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const ref = this.col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return null;

    const { id: _ignoredId, createdAt: _ignoredCreatedAt, ...rest } = patch as Partial<BaseEntity>;
    void _ignoredId;
    void _ignoredCreatedAt;

    await ref.update({ ...rest, updatedAt: nowIso() });
    const updated = await ref.get();
    return this.fromDoc(updated);
  }

  async delete(id: string): Promise<boolean> {
    const ref = this.col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return false;
    await ref.delete();
    return true;
  }

  /** Atomically increment a numeric field (e.g. counters, study minutes). */
  async increment(id: string, field: keyof T, by = 1): Promise<void> {
    await this.col.doc(id).update({
      [field as string]: FieldValue.increment(by),
      updatedAt: nowIso(),
    });
  }

  /** Run a list query with optional filters/ordering/limit. */
  async find(options: FindOptions = {}): Promise<T[]> {
    const snap = await this.buildQuery(options).get();
    return snap.docs.map((d) => this.fromDoc(d)).filter((x): x is T => x !== null);
  }

  async findOne(options: FindOptions = {}): Promise<T | null> {
    const items = await this.find({ ...options, limit: 1 });
    return items[0] ?? null;
  }

  /**
   * Offset-based pagination. Firestore lacks a cheap COUNT, so we issue a
   * `count()` aggregation for total and an `offset/limit` slice for the page.
   */
  async paginate(
    pagination: PaginationParams,
    options: FindOptions = {},
  ): Promise<PaginatedResult<T>> {
    const base = this.buildQuery({ ...options, limit: undefined });

    const [countSnap, pageSnap] = await Promise.all([
      base.count().get(),
      base
        .offset((pagination.page - 1) * pagination.limit)
        .limit(pagination.limit)
        .get(),
    ]);

    const total = countSnap.data().count;
    const items = pageSnap.docs
      .map((d) => this.fromDoc(d))
      .filter((x): x is T => x !== null);

    return buildPaginatedResult(items, total, pagination);
  }

  protected buildQuery(options: FindOptions): Query<DocumentData> {
    let q: Query<DocumentData> = this.col;

    for (const f of options.filters ?? []) {
      q = q.where(f.field, f.op, f.value);
    }
    if (options.orderBy) {
      q = q.orderBy(options.orderBy.field, options.orderBy.direction ?? 'asc');
    }
    if (options.limit !== undefined) {
      q = q.limit(options.limit);
    }
    return q;
  }

  /** Expose a transaction runner so services can compose multi-doc atomic writes. */
  runTransaction<R>(fn: (tx: FirebaseFirestore.Transaction) => Promise<R>): Promise<R> {
    return getDb().runTransaction(fn);
  }
}

/**
 * Base repository for collections scoped to a single user. Adds `userId` filtering
 * to every query so a user can never read another user's data through the repo layer.
 */
export abstract class UserScopedRepository<
  T extends BaseEntity & { userId: string },
> extends BaseRepository<T> {
  async findByIdForUser(id: string, userId: string): Promise<T | null> {
    const entity = await this.findById(id);
    if (!entity || entity.userId !== userId) return null;
    return entity;
  }

  async listForUser(userId: string, options: FindOptions = {}): Promise<T[]> {
    return this.find({
      ...options,
      filters: [{ field: 'userId', op: '==', value: userId }, ...(options.filters ?? [])],
    });
  }

  async paginateForUser(
    userId: string,
    pagination: PaginationParams,
    options: FindOptions = {},
  ): Promise<PaginatedResult<T>> {
    return this.paginate(pagination, {
      ...options,
      filters: [{ field: 'userId', op: '==', value: userId }, ...(options.filters ?? [])],
    });
  }
}
