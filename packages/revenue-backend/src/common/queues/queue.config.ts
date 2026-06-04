import { ConfigService } from '@nestjs/config';
import { BullRootModuleOptions } from '@nestjs/bullmq';

export const getQueueConfig = (
  configService: ConfigService,
): BullRootModuleOptions => ({
  connection: {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),
    ...(process.env.SWAGGER_EXPORT === 'true' ? { lazyConnect: true } : {}),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
});
