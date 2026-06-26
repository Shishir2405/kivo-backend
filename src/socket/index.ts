import type { Server as HttpServer } from 'node:http';

import { Server, type Socket } from 'socket.io';

import { config } from '@/config';
import { SocketEvent } from '@/constants';
import { verifyAccessToken } from '@/utils/jwt';
import { createLogger } from '@/utils/logger';

const log = createLogger('socket');

let io: Server | null = null;

/** Room name for a user's private channel. */
function userRoom(uid: string): string {
  return `user:${uid}`;
}

/**
 * Initialise the Socket.IO server attached to the HTTP server, with JWT handshake
 * auth. Each authenticated client joins its private `user:<uid>` room so the server
 * can target a single user. Returns the io instance.
 */
export function initSocket(httpServer: HttpServer): Server {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: config.app.corsOrigins.length > 0 ? config.app.corsOrigins : true,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        extractTokenFromHeader(socket);
      if (!token) {
        next(new Error('Authentication required'));
        return;
      }
      const claims = verifyAccessToken(token);
      socket.data.uid = claims.uid;
      socket.data.role = claims.role;
      next();
    } catch {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.data.uid as string | undefined;
    if (!uid) {
      socket.disconnect(true);
      return;
    }
    void socket.join(userRoom(uid));
    log.debug({ uid, socketId: socket.id }, 'Socket connected');

    socket.on('disconnect', (reason) => {
      log.debug({ uid, socketId: socket.id, reason }, 'Socket disconnected');
    });
  });

  log.info('Socket.IO server initialised');
  return io;
}

function extractTokenFromHeader(socket: Socket): string | undefined {
  const header = socket.handshake.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

/** Get the initialised io instance, or null if sockets aren't running (e.g. worker process). */
export function getIo(): Server | null {
  return io;
}

/** Emit an arbitrary event to a single user's room. No-op if sockets aren't running. */
export function emitToUser(uid: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(userRoom(uid)).emit(event, payload);
}

export async function closeSocket(): Promise<void> {
  if (io) {
    await io.close();
    io = null;
    log.info('Socket.IO server closed');
  }
}

// ── Typed emit helpers, one per SocketEvent ────────────────────────────────

export function emitRevisionDue(
  uid: string,
  payload: { revisionId: string; entityType: string; entityTitle: string; dueAt: string },
): void {
  emitToUser(uid, SocketEvent.REVISION_DUE, payload);
}

export function emitRevisionUpdated(
  uid: string,
  payload: { revisionId: string; status: string },
): void {
  emitToUser(uid, SocketEvent.REVISION_UPDATED, payload);
}

export function emitTaskUpdated(
  uid: string,
  payload: { taskId: string; status: string },
): void {
  emitToUser(uid, SocketEvent.TASK_UPDATED, payload);
}

export function emitNotificationNew(
  uid: string,
  payload: {
    id: string;
    type: string;
    title: string;
    body: string;
    createdAt: string;
  },
): void {
  emitToUser(uid, SocketEvent.NOTIFICATION_NEW, payload);
}

export function emitDashboardRefresh(uid: string): void {
  emitToUser(uid, SocketEvent.DASHBOARD_REFRESH, { at: new Date().toISOString() });
}
