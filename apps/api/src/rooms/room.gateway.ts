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
import { RoomsService } from './rooms.service';

export interface Member {
  clientId: string;
  name: string;
}

const MAX_NAME_LENGTH = 24;

@Injectable()
@WebSocketGateway()
export class RoomGateway {
  @WebSocketServer() server: Server;

  private rooms = new Map<
    string,
    Map<string, { name: string; socketId: string }>
  >();
  private socketMeta = new Map<string, { roomId: string; clientId: string }>();

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
    this.socketMeta.set(client.id, { roomId, clientId });

    const members = this.addMember(roomId, clientId, name, client.id);
    await this.roomsService.touchRoom(roomId);
    this.server.to(`room:${roomId}`).emit('presence:update', { members });

    return {
      event: 'joined',
      data: {
        room: {
          id: room.id,
          createdAt: room.createdAt,
          currentVideoId: room.currentVideoId,
          playing: room.playing === 'true',
          position: Number(room.position),
          updatedAt: room.updatedAt,
          version: Number(room.version),
        },
        members,
        queue: [],
        chat: [],
      },
    };
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
