import { initFirebase } from '@/firebase/admin';
import { closeRedis } from '@/config/redis';
import { createLogger } from '@/utils/logger';

import { closeBullConnection } from './connection';
import { closeQueues } from './queues';
import { registerSchedules } from './scheduler';
import { closeWorkers, startWorkers } from './workers';

const log = createLogger('worker');

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, 'Worker shutting down…');
  try {
    await closeWorkers();
    await closeQueues();
    await closeBullConnection();
    await closeRedis();
    log.info('Worker shutdown complete');
    process.exit(0);
  } catch (err) {
    log.error({ err }, 'Error during worker shutdown');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  initFirebase();
  startWorkers();
  await registerSchedules();
  log.info('Kivo worker process is running');
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  log.error({ reason }, 'Unhandled rejection in worker');
});
process.on('uncaughtException', (err) => {
  log.error({ err }, 'Uncaught exception in worker');
  void shutdown('uncaughtException');
});

main().catch((err) => {
  log.error({ err }, 'Worker failed to start');
  process.exit(1);
});
