import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { z } from 'zod';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { RoomsModule } from './rooms/rooms.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
      validationSchema: z.object({
        PORT: z.coerce.number().default(3001),
        REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
        WEB_ORIGIN: z.string().default('http://localhost:3000'),
      }),
    }),
    RedisModule,
    RoomsModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
