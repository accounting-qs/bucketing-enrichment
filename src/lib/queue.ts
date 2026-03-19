import { Queue } from "bullmq";
import IORedis from "ioredis";

let connection: IORedis | null = null;
let queue: Queue | null = null;

function getRedisConnection(): IORedis {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL is not set");
    }
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

export function getAnalysisQueue(): Queue {
  if (!queue) {
    queue = new Queue("workbook-analysis", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return queue;
}
