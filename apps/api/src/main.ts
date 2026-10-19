import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import { Server } from 'socket.io';
import { AppModule } from './app.module';

class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly webOrigin: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: Record<string, unknown>): Server {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.webOrigin,
        credentials: true,
      },
    }) as Server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const webOrigin = config.get<string>('WEB_ORIGIN', 'http://localhost:3000');

  app.enableCors({ origin: webOrigin, credentials: true });
  app.useWebSocketAdapter(new SocketIoAdapter(app, webOrigin));

  await app.listen(port);
  console.log(`> api listening on http://localhost:${port}`);
}
void bootstrap();
