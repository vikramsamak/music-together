import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

const ROOM_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_TTL_SECONDS = 24 * 60 * 60;

export interface RoomState {
  id: string;
  createdAt: string;
  currentVideoId: string;
  currentTrackId: string;
  playing: 'true' | 'false';
  position: string;
  updatedAt: string;
  version: string;
}

export interface ChatMessage {
  id: string;
  clientId: string;
  name: string;
  text: string;
  at: string;
}

export interface Track {
  id: string;
  videoId: string;
  url: string;
  title: string;
  addedBy: string;
  addedAt: string;
}

export interface PlaybackState {
  currentVideoId: string;
  currentTrackId: string;
  playing: boolean;
  position: number;
  updatedAt: number;
  version: number;
}

const CHAT_LIMIT = 100;

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
        currentTrackId: '',
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

  async getChat(roomId: string): Promise<ChatMessage[]> {
    const rows = await this.redis.lrange(`room:${roomId}:chat`, 0, -1);
    const messages: ChatMessage[] = [];
    for (const row of rows) {
      try {
        messages.push(JSON.parse(row) as ChatMessage);
      } catch {
        // skip corrupt rows
      }
    }
    return messages;
  }

  async appendChat(roomId: string, message: ChatMessage): Promise<void> {
    await this.redis
      .multi()
      .rpush(`room:${roomId}:chat`, JSON.stringify(message))
      .ltrim(`room:${roomId}:chat`, -CHAT_LIMIT, -1)
      .exec();
  }

  async getQueue(roomId: string): Promise<Track[]> {
    const rows = await this.redis.lrange(`room:${roomId}:queue`, 0, -1);
    const tracks: Track[] = [];
    for (const row of rows) {
      try {
        tracks.push(JSON.parse(row) as Track);
      } catch {
        // skip corrupt rows
      }
    }
    return tracks;
  }

  async addTrack(roomId: string, track: Track): Promise<Track[]> {
    await this.redis.rpush(`room:${roomId}:queue`, JSON.stringify(track));
    return this.getQueue(roomId);
  }

  async removeTrack(roomId: string, trackId: string): Promise<Track[]> {
    const tracks = (await this.getQueue(roomId)).filter(
      (t) => t.id !== trackId,
    );
    const key = `room:${roomId}:queue`;
    const pipeline = this.redis.multi().del(key);
    if (tracks.length > 0) {
      pipeline.rpush(key, ...tracks.map((t) => JSON.stringify(t)));
    }
    await pipeline.exec();
    return tracks;
  }

  async getPlayback(roomId: string): Promise<PlaybackState> {
    const room = await this.getRoom(roomId);
    return {
      currentVideoId: room?.currentVideoId ?? '',
      currentTrackId: room?.currentTrackId ?? '',
      playing: room?.playing === 'true',
      position: Number(room?.position ?? 0) || 0,
      updatedAt: Date.parse(room?.updatedAt ?? '') || Date.now(),
      version: Number(room?.version ?? 0) || 0,
    };
  }

  async setPlayback(
    roomId: string,
    patch: Partial<
      Pick<
        PlaybackState,
        'currentVideoId' | 'currentTrackId' | 'playing' | 'position'
      >
    >,
  ): Promise<PlaybackState> {
    const current = await this.getPlayback(roomId);
    const next: PlaybackState = {
      ...current,
      ...patch,
      position: Math.max(0, patch.position ?? current.position),
      updatedAt: Date.now(),
      version: current.version + 1,
    };
    await this.redis
      .multi()
      .hset(`room:${roomId}`, {
        currentVideoId: next.currentVideoId,
        currentTrackId: next.currentTrackId,
        playing: next.playing ? 'true' : 'false',
        position: String(next.position),
        updatedAt: new Date(next.updatedAt).toISOString(),
        version: String(next.version),
      })
      .expire(`room:${roomId}`, ROOM_TTL_SECONDS)
      .exec();
    return next;
  }
}

export function livePosition(state: PlaybackState, now = Date.now()): number {
  return state.playing
    ? Math.max(0, state.position + (now - state.updatedAt) / 1000)
    : state.position;
}

function cryptoRandomInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}
