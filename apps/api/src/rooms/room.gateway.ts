import { Inject, Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Redis } from 'ioredis';
import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  ChatMessage,
  livePosition,
  RoomsService,
  Track,
} from './rooms.service';
import { fetchVideoTitle, parseVideoId } from './youtube';

export interface Member {
  clientId: string;
  name: string;
}

const MAX_NAME_LENGTH = 24;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 5;

const chatSendSchema = z.object({ text: z.string().trim().min(1).max(500) });
const queueAddSchema = z.object({ url: z.string().trim().min(1).max(500) });
const queueRemoveSchema = z.object({ trackId: z.string().min(1).max(64) });
const seekSchema = z.object({
  position: z
    .number()
    .finite()
    .min(0)
    .max(24 * 3600),
});
const endedSchema = z.object({
  videoId: z.string().min(1).max(32),
  version: z.number().int().min(0),
});

@Injectable()
@WebSocketGateway()
export class RoomGateway {
  @WebSocketServer() server: Server;

  private rooms = new Map<
    string,
    Map<string, { name: string; socketId: string }>
  >();
  private socketMeta = new Map<
    string,
    { roomId: string; clientId: string; name: string }
  >();
  private chatTimestamps = new Map<string, number[]>();

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly roomsService: RoomsService,
  ) {}

  @SubscribeMessage('join')
  async join(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { roomId?: string; name?: string; clientId?: string },
  ) {
    const roomId =
      typeof body?.roomId === 'string' ? body.roomId.toUpperCase() : '';
    const clientId =
      typeof body?.clientId === 'string' ? body.clientId.slice(0, 64) : '';
    const name = sanitizeName(body?.name);

    if (!/^[A-Z0-9]{6}$/.test(roomId) || !clientId) {
      return { event: 'error', data: { code: 'BAD_REQUEST' } };
    }
    const room = await this.roomsService.getRoom(roomId);
    if (!room) {
      return { event: 'error', data: { code: 'ROOM_NOT_FOUND', roomId } };
    }

    await client.join(`room:${roomId}`);
    this.socketMeta.set(client.id, { roomId, clientId, name });

    const members = this.addMember(roomId, clientId, name, client.id);
    const chat = await this.roomsService.getChat(roomId);
    const queue = await this.roomsService.getQueue(roomId);
    const playback = await this.roomsService.getPlayback(roomId);
    await this.roomsService.touchRoom(roomId);
    this.server.to(`room:${roomId}`).emit('presence:update', { members });

    return {
      event: 'joined',
      data: {
        room: { id: room.id, createdAt: room.createdAt },
        members,
        queue,
        playback,
        chat,
      },
    };
  }

  @SubscribeMessage('chat:send')
  async chatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) {
      return { event: 'error', data: { code: 'NOT_JOINED' } };
    }
    const parsed = chatSendSchema.safeParse(body);
    if (!parsed.success) {
      return { event: 'error', data: { code: 'BAD_REQUEST' } };
    }
    if (this.isRateLimited(meta.clientId)) {
      return { event: 'error', data: { code: 'RATE_LIMITED' } };
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      clientId: meta.clientId,
      name: meta.name,
      text: parsed.data.text,
      at: new Date().toISOString(),
    };
    await this.roomsService.appendChat(meta.roomId, message);
    this.server.to(`room:${meta.roomId}`).emit('chat:new', message);
    return { event: 'chat:sent', data: { id: message.id } };
  }

  @SubscribeMessage('queue:add')
  async queueAdd(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return { event: 'error', data: { code: 'NOT_JOINED' } };
    const parsed = queueAddSchema.safeParse(body);
    if (!parsed.success) {
      return { event: 'error', data: { code: 'BAD_REQUEST' } };
    }
    const videoId = parseVideoId(parsed.data.url);
    if (!videoId) {
      return { event: 'error', data: { code: 'BAD_VIDEO' } };
    }

    const title = await fetchVideoTitle(videoId);
    const track: Track = {
      id: crypto.randomUUID(),
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title,
      addedBy: meta.name,
      addedAt: new Date().toISOString(),
    };
    const queue = await this.roomsService.addTrack(meta.roomId, track);
    this.emitQueue(meta.roomId, queue);

    const state = await this.roomsService.getPlayback(meta.roomId);
    if (!state.currentVideoId) {
      const next = await this.roomsService.setPlayback(meta.roomId, {
        currentVideoId: track.videoId,
        currentTrackId: track.id,
        position: 0,
        playing: false,
      });
      this.emitPlayback(meta.roomId, next, meta.clientId);
    }
    return { event: 'queue:added', data: { trackId: track.id } };
  }

  @SubscribeMessage('queue:remove')
  async queueRemove(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return { event: 'error', data: { code: 'NOT_JOINED' } };
    const parsed = queueRemoveSchema.safeParse(body);
    if (!parsed.success) {
      return { event: 'error', data: { code: 'BAD_REQUEST' } };
    }

    const before = await this.roomsService.getQueue(meta.roomId);
    const idx = before.findIndex((t) => t.id === parsed.data.trackId);
    if (idx === -1) return;
    const successor = before[idx + 1] ?? null;
    const queue = await this.roomsService.removeTrack(
      meta.roomId,
      parsed.data.trackId,
    );
    this.emitQueue(meta.roomId, queue);

    const state = await this.roomsService.getPlayback(meta.roomId);
    if (state.currentTrackId === parsed.data.trackId) {
      const next = successor
        ? await this.roomsService.setPlayback(meta.roomId, {
            currentVideoId: successor.videoId,
            currentTrackId: successor.id,
            position: 0,
            playing: state.playing,
          })
        : await this.roomsService.setPlayback(meta.roomId, {
            currentVideoId: '',
            currentTrackId: '',
            position: 0,
            playing: false,
          });
      this.emitPlayback(meta.roomId, next, meta.clientId);
    }
  }

  @SubscribeMessage('player:play')
  async playerPlay(@ConnectedSocket() client: Socket) {
    return this.setPlaying(client, true);
  }

  @SubscribeMessage('player:pause')
  async playerPause(@ConnectedSocket() client: Socket) {
    return this.setPlaying(client, false);
  }

  @SubscribeMessage('player:seek')
  async playerSeek(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return { event: 'error', data: { code: 'NOT_JOINED' } };
    const parsed = seekSchema.safeParse(body);
    if (!parsed.success) {
      return { event: 'error', data: { code: 'BAD_REQUEST' } };
    }
    const state = await this.roomsService.getPlayback(meta.roomId);
    if (!state.currentVideoId) return;
    const next = await this.roomsService.setPlayback(meta.roomId, {
      position: parsed.data.position,
    });
    this.emitPlayback(meta.roomId, next, meta.clientId);
  }

  @SubscribeMessage('player:next')
  async playerNext(@ConnectedSocket() client: Socket) {
    return this.advance(client, 1);
  }

  @SubscribeMessage('player:prev')
  async playerPrev(@ConnectedSocket() client: Socket) {
    return this.advance(client, -1);
  }

  @SubscribeMessage('player:ended')
  async playerEnded(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return;
    const parsed = endedSchema.safeParse(body);
    if (!parsed.success) return;

    const state = await this.roomsService.getPlayback(meta.roomId);
    if (
      state.currentVideoId !== parsed.data.videoId ||
      state.version !== parsed.data.version
    ) {
      return;
    }
    const queue = await this.roomsService.getQueue(meta.roomId);
    const idx = queue.findIndex((t) => t.id === state.currentTrackId);
    const successor = queue[idx + 1];
    const next = successor
      ? await this.roomsService.setPlayback(meta.roomId, {
          currentVideoId: successor.videoId,
          currentTrackId: successor.id,
          position: 0,
          playing: true,
        })
      : await this.roomsService.setPlayback(meta.roomId, {
          playing: false,
          position: livePosition(state),
        });
    this.emitPlayback(meta.roomId, next, meta.clientId);
  }

  private async setPlaying(client: Socket, playing: boolean) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return { event: 'error', data: { code: 'NOT_JOINED' } };
    const state = await this.roomsService.getPlayback(meta.roomId);
    if (!state.currentVideoId) return;
    const next = await this.roomsService.setPlayback(meta.roomId, {
      playing,
      position: livePosition(state),
    });
    this.emitPlayback(meta.roomId, next, meta.clientId);
  }

  private async advance(client: Socket, dir: 1 | -1) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return { event: 'error', data: { code: 'NOT_JOINED' } };
    const [queue, state] = await Promise.all([
      this.roomsService.getQueue(meta.roomId),
      this.roomsService.getPlayback(meta.roomId),
    ]);
    if (queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === state.currentTrackId);
    const target = idx === -1 ? queue[0] : queue[idx + dir];
    if (!target) {
      if (dir === -1) {
        const restarted = await this.roomsService.setPlayback(meta.roomId, {
          position: 0,
        });
        this.emitPlayback(meta.roomId, restarted, meta.clientId);
      }
      return;
    }
    const next = await this.roomsService.setPlayback(meta.roomId, {
      currentVideoId: target.videoId,
      currentTrackId: target.id,
      position: 0,
      playing: state.playing,
    });
    this.emitPlayback(meta.roomId, next, meta.clientId);
  }

  private emitQueue(roomId: string, queue: Track[]) {
    this.server.to(`room:${roomId}`).emit('queue:update', { queue });
  }

  private emitPlayback(
    roomId: string,
    state: Awaited<ReturnType<RoomsService['getPlayback']>>,
    senderId: string,
  ) {
    this.server
      .to(`room:${roomId}`)
      .emit('playback:update', { state, senderId, now: Date.now() });
  }

  handleDisconnect(client: Socket) {
    const meta = this.socketMeta.get(client.id);
    this.socketMeta.delete(client.id);
    if (!meta) return;

    const room = this.rooms.get(meta.roomId);
    const member = room?.get(meta.clientId);
    if (room && member?.socketId === client.id) {
      room.delete(meta.clientId);
      if (room.size === 0) this.rooms.delete(meta.roomId);
      const members = this.memberList(meta.roomId);
      this.server
        .to(`room:${meta.roomId}`)
        .emit('presence:update', { members });
    }
  }

  private isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = (this.chatTimestamps.get(key) ?? []).filter(
      (t) => t > windowStart,
    );
    if (timestamps.length >= RATE_LIMIT_MAX) {
      this.chatTimestamps.set(key, timestamps);
      return true;
    }
    timestamps.push(now);
    this.chatTimestamps.set(key, timestamps);
    return false;
  }

  private addMember(
    roomId: string,
    clientId: string,
    name: string,
    socketId: string,
  ): Member[] {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Map();
      this.rooms.set(roomId, room);
    }
    room.set(clientId, { name, socketId });
    return this.memberList(roomId);
  }

  private memberList(roomId: string): Member[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return [...room.entries()].map(([clientId, v]) => ({
      clientId,
      name: v.name,
    }));
  }
}

function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return 'Guest';
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  return trimmed || 'Guest';
}
