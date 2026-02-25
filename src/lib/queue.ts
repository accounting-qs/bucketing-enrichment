import { Queue, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Setup Redis connection options
const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // Critical for BullMQ
});

// Define the Queue
export const analyzeQueue = new Queue('workbook-analysis', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
    }
});

export default analyzeQueue;
