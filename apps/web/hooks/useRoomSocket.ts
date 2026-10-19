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

export interface ChatMessage {
  id: string;
  clientId: string;
  name: string;
  text: string;
  at: string;
}

const CHAT_CLIENT_CAP = 200;

export function useRoomSocket(roomId: string, name: string | null) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [members, setMembers] = useState<Member[]>([]);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const sendChat = (text: string) => {
    setErrorCode(null);
    socketRef.current?.emit("chat:send", { text });
  };

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
    socket.on(
      "joined",
      (data: { room: RoomInfo; members: Member[]; chat?: ChatMessage[] }) => {
        setRoom(data.room);
        setMembers(data.members);
        setChat(data.chat ?? []);
        setError(null);
        setErrorCode(null);
        setStatus("joined");
      },
    );
    socket.on("presence:update", (data: { members: Member[] }) => {
      setMembers(data.members);
    });
    socket.on("chat:new", (message: ChatMessage) => {
      setChat((prev) => [...prev, message].slice(-CHAT_CLIENT_CAP));
    });
    socket.on("error", (data: { code?: string }) => {
      if (data?.code === "ROOM_NOT_FOUND") {
        setError("Room not found. Check the room code.");
        setStatus("error");
        socket.close();
        return;
      }
      setErrorCode(data?.code ?? "BAD_REQUEST");
    });
    socket.on("disconnect", () => {
      if (socket.active) setStatus("disconnected");
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, name]);

  return {
    status,
    members,
    room,
    chat,
    error,
    errorCode,
    sendChat,
    clientId: getClientIdSafe(),
  };
}

function getClientIdSafe(): string | null {
  if (typeof window === "undefined") return null;
  return getClientId();
}
