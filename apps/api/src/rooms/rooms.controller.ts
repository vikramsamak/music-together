import { Controller, Post } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('api')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post('rooms')
  async createRoom() {
    const roomId = await this.rooms.createRoom();
    return { roomId };
  }
}
