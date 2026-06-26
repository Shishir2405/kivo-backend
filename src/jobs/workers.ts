import { Worker } from 'bullmq';

import { config } from '@/config';
import { QueueName } from '@/constants';
import { createLogger } from '@/utils/logger';

import { bullConnection } from './connection';
import {
  analyticsProcessor,
  maintenanceProcessor,
  notificationProcessor,
  revisionProcessor,
} from './processors';

const log = createLogger('workers');

let workers: Worker[] = [];

function makeWorker(
  name: QueueName,
  processor: (job: import('bullmq').Job) => Promise<void>,
): Worker {
  const worker = new Worker(name, processor, {
    connection: bullConnection,
    prefix: config.bullmq.prefix,
    concurrency: config.bullmq.concurrency,
  });

  worker.on('completed', (job) => {
    log.debug({ queue: name, jobId: job.id, jobName: job.name }, 'Job completed');
  });
  worker.on('failed', (job, err) => {
    log.error(
      { queue: name, jobId: job?.id, jobName: job?.name, attemptsMade: job?.attemptsMade, err },
      'Job failed',
    );
  });
  worker.on('error', (err) => {
    log.error({ queue: name, err }, 'Worker error');
  });

  return worker;
}

/** Start one worker per queue. Call once in the worker process. */
export function startWorkers(): Worker[] {
  if (workers.length > 0) return workers;

  workers = [
    makeWorker(QueueName.REVISION, revisionProcessor),
    makeWorker(QueueName.NOTIFICATION, notificationProcessor),
    makeWorker(QueueName.ANALYTICS, analyticsProcessor),
    makeWorker(QueueName.MAINTENANCE, maintenanceProcessor),
  ];

  log.info({ queues: Object.values(QueueName) }, 'BullMQ workers started');
  return workers;
}

export async function closeWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers = [];
  log.info('BullMQ workers closed');
}
