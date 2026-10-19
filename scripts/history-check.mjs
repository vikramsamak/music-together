// Verifies chat history survives an API restart (persisted in Redis).
// Usage:
//   node scripts/history-check.mjs write
//   <restart the api>
//   node scripts/history-check.mjs read <roomId>
import { io } from "socket.io-client";

const API = process.env.API_URL ?? "http://localhost:3001";
const [mode, roomId] = process.argv.slice(2);

function join(roomId, name, clientId) {
  const socket = io(API, { transports: ["websocket"] });
  const joinedP = new Promise((resolve, reject) => {
    socket.on("joined", resolve);
    socket.on("error", reject);
    setTimeout(() => reject(new Error("join timeout")), 5000);
  });
  socket.emit("join", { roomId, name, clientId });
  return { socket, joinedP };
}

if (mode === "write") {
  const res = await fetch(`${API}/api/rooms`, { method: "POST" });
  const id = (await res.json()).roomId;
  const a = join(id, "Alice", "client-a");
  await a.joinedP;
  a.socket.emit("chat:send", { text: "persisted hello" });
  await new Promise((r) => setTimeout(r, 400));
  console.log(`ROOM_ID=${id}`);
  a.socket.close();
} else if (mode === "read") {
  const b = join(roomId, "Bob", "client-b");
  const data = await b.joinedP;
  const found = data.chat?.some((m) => m.text === "persisted hello");
  console.log(`${found ? "ok  " : "FAIL"} history survived restart (${data.chat?.length ?? 0} messages)`);
  b.socket.close();
  process.exitCode = found ? 0 : 1;
} else {
  console.error("usage: write | read <roomId>");
  process.exitCode = 2;
}
