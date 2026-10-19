import { Redis } from 'ioredis';
import {
  ChatMessage,
  livePosition,
  RoomsService,
  Track,
} from './rooms.service';

interface Chain {
  hset(key: string, value: Record<string, string>): Chain;
  expire(key: string, seconds: number): Chain;
  rpush(key: string, ...values: string[]): Chain;
  ltrim(key: string, start: number, end: number): Chain;
  del(key: string): Chain;
  exec(): Promise<unknown[]>;
}

class FakeRedis {
  hashes = new Map<string, Record<string, string>>();
  lists = new Map<string, string[]>();
  ttls = new Map<string, number>();

  hset(key: string, value: Record<string, string>): number {
    this.hashes.set(key, { ...(this.hashes.get(key) ?? {}), ...value });
    return 1;
  }

  hgetall(key: string): Record<string, string> {
    return this.hashes.get(key) ?? {};
  }

  exists(key: string): number {
    return this.hashes.has(key) || this.lists.has(key) ? 1 : 0;
  }

  expire(key: string, seconds: number): number {
    this.ttls.set(key, seconds);
    return 1;
  }

  lrange(key: string, start: number, end: number): string[] {
    const list = this.lists.get(key) ?? [];
    const from = start < 0 ? Math.max(0, list.length + start) : start;
    const to = end < 0 ? list.length + end + 1 : end + 1;
    return list.slice(from, to);
  }

  rpush(key: string, ...values: string[]): number {
    const list = this.lists.get(key) ?? [];
    list.push(...values);
    this.lists.set(key, list);
    return list.length;
  }

  ltrim(key: string, start: number, end: number): string {
    const list = this.lists.get(key) ?? [];
    const from = start < 0 ? Math.max(0, list.length + start) : start;
    const to = end < 0 ? list.length + end + 1 : end + 1;
    this.lists.set(key, list.slice(from, to));
    return 'OK';
  }

  del(key: string): number {
    this.hashes.delete(key);
    this.lists.delete(key);
    return 1;
  }

  multi(): Chain {
    const ops: (() => void)[] = [];
    const chain: Chain = {
      hset: (k, v) => {
        ops.push(() => void this.hset(k, v));
        return chain;
      },
      expire: (k, s) => {
        ops.push(() => void this.expire(k, s));
        return chain;
      },
      rpush: (k, ...v) => {
        ops.push(() => void this.rpush(k, ...v));
        return chain;
      },
      ltrim: (k, a, b) => {
        ops.push(() => void this.ltrim(k, a, b));
        return chain;
      },
      del: (k) => {
        ops.push(() => void this.del(k));
        return chain;
      },
      exec: () => {
        ops.forEach((op) => op());
        return Promise.resolve([]);
      },
    };
    return chain;
  }
}

function makeTrack(n: number): Track {
  return {
    id: `track-${n}`,
    videoId: 'dQw4w9WgXcQ',
    url: 'https://youtu.be/dQw4w9WgXcQ',
    title: `Track ${n}`,
    addedBy: 'Alice',
    addedAt: new Date().toISOString(),
  };
}

describe('RoomsService', () => {
  let redis: FakeRedis;
  let service: RoomsService;

  beforeEach(() => {
    redis = new FakeRedis();
    service = new RoomsService(redis as unknown as Redis);
  });

  it('creates a room with six-character ids and zeroed playback', async () => {
    const roomId = await service.createRoom();
    expect(roomId).toMatch(/^[A-Z0-9]{6}$/);
    const playback = await service.getPlayback(roomId);
    expect(playback).toMatchObject({
      currentVideoId: '',
      currentTrackId: '',
      playing: false,
      position: 0,
      version: 0,
    });
  });

  it('caps the queue at 50 tracks', async () => {
    const roomId = await service.createRoom();
    for (let i = 1; i <= 50; i++) {
      expect(await service.addTrack(roomId, makeTrack(i))).not.toBeNull();
    }
    expect(await service.addTrack(roomId, makeTrack(51))).toBeNull();
    expect(await service.getQueue(roomId)).toHaveLength(50);
  });

  it('removes tracks by id, keeping order', async () => {
    const roomId = await service.createRoom();
    await service.addTrack(roomId, makeTrack(1));
    await service.addTrack(roomId, makeTrack(2));
    await service.addTrack(roomId, makeTrack(3));
    const rest = await service.removeTrack(roomId, 'track-2');
    expect(rest.map((t) => t.id)).toEqual(['track-1', 'track-3']);
  });

  it('bumps version on every playback change and clamps position', async () => {
    const roomId = await service.createRoom();
    const first = await service.setPlayback(roomId, {
      currentVideoId: 'dQw4w9WgXcQ',
      currentTrackId: 'track-1',
      position: -5,
    });
    expect(first.version).toBe(1);
    expect(first.position).toBe(0);
    const second = await service.setPlayback(roomId, { playing: true });
    expect(second.version).toBe(2);
    expect(second.currentVideoId).toBe('dQw4w9WgXcQ');
  });

  it('keeps only the last 100 chat messages', async () => {
    const roomId = await service.createRoom();
    for (let i = 0; i < 105; i++) {
      const message: ChatMessage = {
        id: `m${i}`,
        clientId: 'c1',
        name: 'Alice',
        text: `message ${i}`,
        at: new Date().toISOString(),
      };
      await service.appendChat(roomId, message);
    }
    const chat = await service.getChat(roomId);
    expect(chat).toHaveLength(100);
    expect(chat[0].id).toBe('m5');
  });

  it('shortens the TTL of all keys for an empty room', async () => {
    const roomId = await service.createRoom();
    await service.expireEmptyRoom(roomId);
    expect(redis.ttls.get(`room:${roomId}`)).toBe(30 * 60);
    expect(redis.ttls.get(`room:${roomId}:queue`)).toBe(30 * 60);
    expect(redis.ttls.get(`room:${roomId}:chat`)).toBe(30 * 60);
  });
});

describe('livePosition', () => {
  const base = {
    currentVideoId: 'dQw4w9WgXcQ',
    currentTrackId: 'track-1',
    playing: true,
    position: 30,
    updatedAt: 1_000_000,
    version: 3,
  };

  it('advances with elapsed time while playing', () => {
    expect(livePosition(base, 1_005_000)).toBeCloseTo(35, 5);
  });

  it('stays put while paused', () => {
    expect(livePosition({ ...base, playing: false }, 1_005_000)).toBe(30);
  });

  it('never goes negative', () => {
    expect(livePosition({ ...base, position: 1 }, 996_000)).toBe(0);
  });
});
