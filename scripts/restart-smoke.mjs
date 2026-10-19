// Phase 4 verification: killing and restarting the API resyncs connected clients.
// Spawns its own API on :3005 (Redis must be running).
// Usage: node scripts/restart-smoke.mjs
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";

const PORT = "3005";
const API = `http://localhost:${PORT}`;
const apiDir = fileURLToPath(new URL("../apps/api", import.meta.url));

let failures = 0;
function check(cond, label) {
  console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures += 1;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let api = null;
function startApi() {
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: apiDir,
    env: {
      ...process.env,
      PORT,
      REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
      WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => process.stderr.write(`[api] ${d}`));
  return child;
}

function stopApi(child) {
  return new Promise((resolve) => {
    if (!child) return resolve();
    const done = () => resolve();
    child.once("exit", done);
    child.kill();
    setTimeout(done, 3000);
  });
}

async function waitForApi(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${API}/api/rooms`, { method: "POST" });
      if (res.ok) return (await res.json()).roomId;
    } catch {
      // not up yet
    }
    await wait(400);
  }
  throw new Error("API did not start in time");
}

try {
  api = startApi();
  const roomId = await waitForApi();

  const socket = io(API, { transports: ["websocket"] });
  let joinedCount = 0;
  let snapshot = null;
  socket.on("joined", (data) => {
    joinedCount += 1;
    snapshot = data;
  });
  socket.on("connect_error", (err) =>
    console.log(`note connect_error: ${err.message}`),
  );
  socket.io.on("reconnect", () => console.log("note manager reconnected"));
  socket.on("connect", () =>
    socket.emit("join", { roomId, name: "Alice", clientId: "client-a" }),
  );
  const deadline = Date.now() + 8000;
  while (joinedCount < 1 && Date.now() < deadline) await wait(100);
  check(joinedCount === 1, "client joined the first API instance");

  socket.emit("chat:send", { text: "survives a restart" });
  socket.emit("queue:add", { url: "https://youtu.be/dQw4w9WgXcQ" });
  await wait(1500);

  await stopApi(api);
  api = null;
  await wait(1000);
  check(joinedCount === 1, "no join while the api is down");

  api = startApi();
  await waitForApi();
  console.log("note second API instance is up");
  const reconnectDeadline = Date.now() + 25000;
  while (joinedCount < 2 && Date.now() < reconnectDeadline) await wait(200);
  check(joinedCount >= 2, "client reconnected and re-joined automatically");
  check(
    snapshot?.chat?.some((m) => m.text === "survives a restart"),
    "chat history restored after restart",
  );
  check(snapshot?.queue?.length === 1, "queue restored after restart");
  check(
    !!snapshot?.playback?.currentVideoId,
    "playback state restored after restart",
  );
  socket.close();
} catch (err) {
  check(false, `threw: ${err.message}`);
} finally {
  await stopApi(api);
}

console.log(failures === 0 ? "RESTART SMOKE PASSED" : `FAILED: ${failures}`);
process.exitCode = failures === 0 ? 0 : 1;
