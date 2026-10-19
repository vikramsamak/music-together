import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        const client = new Redis(
          process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
        );
        client.on('error', (err) => console.error('[redis]', err.message));
        return client;
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
