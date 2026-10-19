"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "@/lib/config";
import { getClientId } from "@/lib/clientId";

export interface Member {
  clientId: string;
  name: string;
}

export interface RoomInfo {
  id: string;
  createdAt: string;
  currentVideoId: string;
  playing: boolean;
  position: number;
  version: number;
}

export type ConnectionStatus =
  | "connecting"
  | "joined"
  | "disconnected"
  | "error";

export function useRoomSocket(roomId: string, name: string | null) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [members, setMembers] = useState<Member[]>([]);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!name) return;

    const clientId = getClientId();
    const socket = io(API_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    const join = () => {
      setStatus("connecting");
      socket.emit("join", { roomId, name, clientId });
    };

    socket.on("connect", join);
    socket.on("joined", (data: { room: RoomInfo; members: Member[] }) => {
      setRoom(data.room);
      setMembers(data.members);
      setError(null);
      setStatus("joined");
    });
    socket.on("presence:update", (data: { members: Member[] }) => {
      setMembers(data.members);
    });
    socket.on("error", (data: { code?: string }) => {
      if (data?.code === "ROOM_NOT_FOUND") {
        setError("Room not found. Check the room code.");
        setStatus("error");
        socket.close();
      } else {
        setError("Something went wrong.");
      }
    });
    socket.on("disconnect", () => {
      if (socket.active) setStatus("disconnected");
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, name]);

  return { status, members, room, error, clientId: getClientIdSafe() };
}

function getClientIdSafe(): string | null {
  if (typeof window === "undefined") return null;
  return getClientId();
}
