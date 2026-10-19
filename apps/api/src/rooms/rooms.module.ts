import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomGateway } from './room.gateway';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService, RoomGateway],
})
export class RoomsModule {}
