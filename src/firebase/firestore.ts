import {
  FieldValue,
  Filter,
  getFirestore,
  Timestamp,
  type CollectionReference,
  type Firestore,
} from 'firebase-admin/firestore';

import { getFirebaseApp } from './admin';

let db: Firestore | null = null;

/**
 * Lazily-initialised Firestore singleton with sane settings.
 * `ignoreUndefinedProperties` keeps writes clean — undefined fields are dropped
 * instead of throwing, which pairs well with partial updates.
 */
export function getDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

/** Typed collection accessor. */
export function collection<T = FirebaseFirestore.DocumentData>(
  name: string,
): CollectionReference<T> {
  return getDb().collection(name) as CollectionReference<T>;
}

/** Liveness probe — issues a cheap read to confirm Firestore is reachable. */
export async function pingFirestore(): Promise<boolean> {
  try {
    await getDb().collection('__health__').limit(1).get();
    return true;
  } catch {
    return false;
  }
}

export { FieldValue, Filter, Timestamp };
