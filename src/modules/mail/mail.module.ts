import { Module, Global } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';

const isRedisEnabled = Boolean(
  process.env.REDIS_URL ||
    process.env.REDIS_ENABLED === 'true' ||
    (process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost'),
);

const moduleImports = isRedisEnabled
  ? [
      BullModule.forRootAsync({
        useFactory: () => {
          if (process.env.REDIS_URL) {
            return {
              connection: {
                url: process.env.REDIS_URL,
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                retryStrategy: (times: number) => Math.min(times * 500, 3000),
              },
            };
          }
          return {
            connection: {
              host: process.env.REDIS_HOST || '127.0.0.1',
              port: Number(process.env.REDIS_PORT) || 6379,
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
              retryStrategy: (times: number) => Math.min(times * 500, 3000),
            },
          };
        },
      }),
      BullModule.registerQueue({
        name: 'mail-queue',
      }),
    ]
  : [];

const moduleProviders: any[] = [MailService];
const moduleExports: any[] = [MailService];

if (isRedisEnabled) {
  moduleProviders.push(MailProcessor);
  moduleExports.push(BullModule);
} else {
  const queueToken = getQueueToken('mail-queue');
  moduleProviders.push({
    provide: queueToken,
    useValue: null,
  });
  moduleExports.push(queueToken);
}

@Global()
@Module({
  imports: moduleImports,
  providers: moduleProviders,
  exports: moduleExports,
})
export class MailModule {}

