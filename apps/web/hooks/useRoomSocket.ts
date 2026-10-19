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

export interface PlaybackEvent {
  state: PlaybackState;
  senderId: string | null;
  seq: number;
}

const CHAT_CLIENT_CAP = 200;

export function useRoomSocket(roomId: string, name: string | null) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [members, setMembers] = useState<Member[]>([]);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [playbackEvent, setPlaybackEvent] = useState<PlaybackEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const playbackRef = useRef<PlaybackState | null>(null);
  const serverOffsetRef = useRef(0);
  const seqRef = useRef(0);

  const sendChat = (text: string) => {
    setErrorCode(null);
    socketRef.current?.emit("chat:send", { text });
  };

  const addTrack = (url: string) => {
    setErrorCode(null);
    socketRef.current?.emit("queue:add", { url });
  };
  const removeTrack = (trackId: string) => {
    socketRef.current?.emit("queue:remove", { trackId });
  };
  const play = () => socketRef.current?.emit("player:play");
  const pause = () => socketRef.current?.emit("player:pause");
  const seek = (position: number) =>
    socketRef.current?.emit("player:seek", { position });
  const next = () => socketRef.current?.emit("player:next");
  const prev = () => socketRef.current?.emit("player:prev");
  const reportEnded = (videoId: string, version: number) =>
    socketRef.current?.emit("player:ended", { videoId, version });

  useEffect(() => {
    if (!name) return;

    const clientId = getClientId();
    const socket = io(API_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    const applyPlayback = (
      state: PlaybackState,
      senderId: string | null,
      serverNow?: number,
    ) => {
      if (typeof serverNow === "number") {
        serverOffsetRef.current = serverNow - Date.now();
      }
      playbackRef.current = state;
      setPlayback(state);
      setPlaybackEvent({ state, senderId, seq: ++seqRef.current });
    };

    const join = () => {
      setStatus("connecting");
      socket.emit("join", { roomId, name, clientId });
    };

    socket.on("connect", join);
    socket.on(
      "joined",
      (data: {
        room: RoomInfo;
        members: Member[];
        chat?: ChatMessage[];
        queue?: Track[];
        playback?: PlaybackState;
        now?: number;
      }) => {
        setRoom(data.room);
        setMembers(data.members);
        setChat(data.chat ?? []);
        setQueue(data.queue ?? []);
        if (data.playback) applyPlayback(data.playback, null, data.now);
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
    socket.on("queue:update", (data: { queue: Track[] }) => {
      setQueue(data.queue);
    });
    socket.on(
      "playback:update",
      (data: { state: PlaybackState; senderId?: string; now?: number }) => {
        applyPlayback(data.state, data.senderId ?? null, data.now);
      },
    );
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
    queue,
    playback,
    playbackEvent,
    error,
    errorCode,
    sendChat,
    addTrack,
    removeTrack,
    play,
    pause,
    seek,
    next,
    prev,
    reportEnded,
    playbackRef,
    serverNow: () => Date.now() + serverOffsetRef.current,
    clientId: getClientIdSafe(),
  };
}

function getClientIdSafe(): string | null {
  if (typeof window === "undefined") return null;
  return getClientId();
}
