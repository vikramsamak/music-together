import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    // ConfigModule loads .env.local/.env into process.env before providers are
    // created. We can't inject ConfigService here: @nestjs/config is ESM-only,
    // and the e2e wires RedisModule directly (no AppModule) under CJS Jest.
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
    this.client.on('error', (err: Error) =>
      console.error('[redis]', err.message),
    );
  }

  onModuleDestroy() {
    // Hard close: quit() can surface an unhandled "Connection is closed" from
    // ioredis' internal queue flush during jest/app teardown.
    this.client.disconnect();
  }
}

@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (redis: RedisService) => redis.client,
      inject: [RedisService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
