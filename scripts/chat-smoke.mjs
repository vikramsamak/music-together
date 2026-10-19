// Phase 2 smoke test: chat exchange, history for late joiner, rate limit, size cap.
// Usage: node scripts/chat-smoke.mjs   (API must be running on :3001)
import { io } from "socket.io-client";

const API = process.env.API_URL ?? "http://localhost:3001";

let failures = 0;
function check(cond, label) {
  console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures += 1;
}

async function createRoom() {
  const res = await fetch(`${API}/api/rooms`, { method: "POST" });
  if (!res.ok) throw new Error(`POST /api/rooms failed: ${res.status}`);
  return (await res.json()).roomId;
}

function connect(roomId, name, clientId) {
  const socket = io(API, { transports: ["websocket"] });
  const chat = [];
  const errors = [];
  const joinedP = new Promise((resolve, reject) => {
    socket.on("joined", resolve);
    socket.on("error", reject);
    setTimeout(() => reject(new Error(`${name}: join timeout`)), 5000);
  });
  socket.on("chat:new", (m) => chat.push(m));
  socket.on("error", (e) => errors.push(e));
  socket.emit("join", { roomId, name, clientId });
  return { socket, chat, errors, joinedP };
}

const roomId = await createRoom();
const a = connect(roomId, "Alice", "client-a");
const aJoined = await a.joinedP;

a.socket.emit("chat:send", { text: "hello" });
await new Promise((r) => setTimeout(r, 400));
check(
  a.chat.some((m) => m.text === "hello" && m.name === "Alice"),
  "A receives own message echo",
);

const b = connect(roomId, "Bob", "client-b");
const bJoined = await b.joinedP;
check(
  bJoined.chat?.some((m) => m.text === "hello"),
  "late joiner B gets chat history in snapshot",
);

b.socket.emit("chat:send", { text: "hi back" });
await new Promise((r) => setTimeout(r, 400));
check(
  a.chat.some((m) => m.text === "hi back" && m.name === "Bob"),
  "A receives B's message live",
);

for (let i = 1; i <= 5; i++) {
  a.socket.emit("chat:send", { text: `burst ${i}` });
}
a.socket.emit("chat:send", { text: "x".repeat(600) });
await new Promise((r) => setTimeout(r, 600));
check(
  a.errors.some((e) => e.code === "RATE_LIMITED"),
  "burst beyond 5/10s is rate limited",
);
check(
  a.errors.some((e) => e.code === "BAD_REQUEST"),
  "600-char message rejected as BAD_REQUEST",
);
check(aJoined.chat.length === 0, "A joined with empty history");

console.log(failures === 0 ? "CHAT SMOKE PASSED" : `FAILED: ${failures}`);
process.exitCode = failures === 0 ? 0 : 1;
a.socket.close();
b.socket.close();
