import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

const ROOM_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_TTL_SECONDS = 24 * 60 * 60;

export interface RoomState {
  id: string;
  createdAt: string;
  currentVideoId: string;
  playing: 'true' | 'false';
  position: string;
  updatedAt: string;
  version: string;
}

@Injectable()
export class RoomsService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  createRoomId(): string {
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += ROOM_ID_ALPHABET[cryptoRandomInt(ROOM_ID_ALPHABET.length)];
    }
    return id;
  }

  async createRoom(): Promise<string> {
    const id = this.createRoomId();
    const now = new Date().toISOString();
    await this.redis
      .multi()
      .hset(`room:${id}`, {
        id,
        createdAt: now,
        currentVideoId: '',
        playing: 'false',
        position: '0',
        updatedAt: now,
        version: '0',
      })
      .expire(`room:${id}`, ROOM_TTL_SECONDS)
      .exec();
    return id;
  }

  async getRoom(roomId: string): Promise<RoomState | null> {
    const room = await this.redis.hgetall(`room:${roomId}`);
    return room.id ? (room as unknown as RoomState) : null;
  }

  async roomExists(roomId: string): Promise<boolean> {
    return (await this.redis.exists(`room:${roomId}`)) === 1;
  }

  async touchRoom(roomId: string): Promise<void> {
    await this.redis.expire(`room:${roomId}`, ROOM_TTL_SECONDS);
  }
}

function cryptoRandomInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}
