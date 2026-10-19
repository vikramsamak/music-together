import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { RedisModule } from './../src/redis/redis.module';
import { RoomsModule } from './../src/rooms/rooms.module';

// NOTE: AppModule pulls in @nestjs/config, which ships as ESM and cannot be
// require()d by this Jest version. The rooms surface only needs Redis + the
// gateway, so the e2e wires those modules directly.
const testModules = [RedisModule, RoomsModule];

interface Joined {
  room: { id: string };
  members: { clientId: string; name: string }[];
  queue: unknown[];
  chat: unknown[];
}

function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error as Error);
      },
    );
  });
}

describe('Rooms (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let url: string;
  let socket: Socket | null = null;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: testModules,
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);
    httpServer = app.getHttpServer() as Server;
    const address = httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 3001;
    url = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    socket?.close();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await app.close();
  });

  async function createRoom(): Promise<string> {
    const res = await request(httpServer).post('/api/rooms').expect(201);
    return (res.body as { roomId: string }).roomId;
  }

  it('creates a room over REST', async () => {
    const roomId = await createRoom();
    expect(roomId).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('reports unknown rooms', async () => {
    socket = io(url, { transports: ['websocket'] });
    const error = await withTimeout(
      new Promise<{ code: string }>((resolve, reject) => {
        socket!.on('error', resolve);
        socket!.on('joined', () => reject(new Error('should not join')));
        socket!.emit('join', {
          roomId: 'ZZZZZZ',
          name: 'Alice',
          clientId: 'e2e',
        });
      }),
    );
    expect(error.code).toBe('ROOM_NOT_FOUND');
    socket.close();
    socket = null;
  });

  it('lets a client join and returns a full snapshot', async () => {
    const roomId = await createRoom();
    socket = io(url, { transports: ['websocket'] });
    const joined = await withTimeout(
      new Promise<Joined>((resolve, reject) => {
        socket!.on('joined', resolve);
        socket!.on('error', reject);
        socket!.emit('join', { roomId, name: 'Alice', clientId: 'e2e-a' });
      }),
    );
    expect(joined.room.id).toBe(roomId);
    expect(joined.members.map((m) => m.name)).toEqual(['Alice']);
    expect(joined.queue).toEqual([]);
    expect(joined.chat).toEqual([]);
  });
});
