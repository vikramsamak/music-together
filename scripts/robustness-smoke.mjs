// Phase 4 smoke test: malformed frames, limits, presence dedupe, ENDED-once, TTLs.
// Usage: node scripts/robustness-smoke.mjs   (API on :3001 + Redis must be running)
import { io } from "socket.io-client";
import { Redis } from "ioredis";

const API = process.env.API_URL ?? "http://localhost:3001";
const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

let failures = 0;
function check(cond, label) {
  console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures += 1;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function createRoom() {
  const res = await fetch(`${API}/api/rooms`, { method: "POST" });
  return (await res.json()).roomId;
}

function connect(roomId, name, clientId) {
  const socket = io(API, { transports: ["websocket"] });
  const events = { playback: [], errors: [], presence: [] };
  let lastState = null;
  const joinedP = new Promise((resolve, reject) => {
    socket.on("joined", resolve);
    socket.on("error", reject);
    setTimeout(() => reject(new Error("join timeout")), 5000);
  });
  socket.on("playback:update", (d) => {
    lastState = d.state;
    events.playback.push(d);
  });
  socket.on("error", (e) => events.errors.push(e));
  socket.on("presence:update", (d) => events.presence.push(d.members));
  socket.emit("join", { roomId, name, clientId });
  return { socket, events, joinedP, getState: () => lastState };
}

// --- malformed frames are rejected and the server stays up -------------------
{
  const roomId = await createRoom();
  const a = connect(roomId, "Alice", "client-a");
  await a.joinedP;
  const before = a.events.errors.length;
  a.socket.emit("chat:send", { text: 123 });
  a.socket.emit("chat:send", {});
  a.socket.emit("queue:add", { url: 5 });
  a.socket.emit("queue:add", {});
  a.socket.emit("queue:remove", {});
  a.socket.emit("player:seek", { position: "nope" });
  a.socket.emit("player:ended", { nope: true });
  a.socket.emit("bogus:event", { anything: true });
  await wait(500);
  const bad = a.events.errors.slice(before);
  check(
    bad.filter((e) => e.code === "BAD_REQUEST").length >= 4,
    `malformed frames rejected (${bad.length} errors)`,
  );
  a.socket.emit("chat:send", { text: "still alive" });
  await wait(300);
  check(
    a.events.errors.length === bad.length + before,
    "server accepts valid frames after malformed ones",
  );
  a.socket.close();
}

// --- bad join payload --------------------------------------------------------
{
  const socket = io(API, { transports: ["websocket"] });
  const errP = new Promise((resolve) => socket.on("error", resolve));
  socket.emit("join", { roomId: "AAAAAA" });
  const err = await Promise.race([
    errP,
    wait(2000).then(() => ({ code: "timeout" })),
  ]);
  check(err.code === "BAD_REQUEST", "join without clientId -> BAD_REQUEST");
  socket.close();
}

// --- name cap + presence dedupe by clientId ----------------------------------
{
  const roomId = await createRoom();
  const a = connect(roomId, "x".repeat(100), "dup");
  const aJoined = await a.joinedP;
  check(
    aJoined.members[0]?.name.length === 24,
    `name truncated to 24 chars (${aJoined.members[0]?.name.length})`,
  );
  const b = connect(roomId, "Bob", "dup");
  await b.joinedP;
  await wait(200);
  const members = a.events.presence.at(-1) ?? aJoined.members;
  check(
    members.filter((m) => m.clientId === "dup").length === 1,
    "same clientId does not duplicate presence",
  );
  a.socket.close();
  await wait(400);
  const afterClose = b.events.presence.at(-1) ?? members;
  check(
    afterClose.some((m) => m.clientId === "dup"),
    "closing the stale socket keeps the reconnected member",
  );
  b.socket.close();
}

// --- ENDED advances exactly once with two reporters ---------------------------
{
  const roomId = await createRoom();
  const a = connect(roomId, "Alice", "client-a");
  await a.joinedP;
  const V1 = "dQw4w9WgXcQ";
  const V2 = "jNQXAC9IVRw";
  a.socket.emit("queue:add", { url: `https://youtu.be/${V1}` });
  await wait(1500);
  a.socket.emit("queue:add", { url: `https://youtu.be/${V2}` });
  await wait(1500);
  const state = a.getState();
  check(state?.currentVideoId === V1, "first track is current before ENDED");
  const b = connect(roomId, "Bob", "client-b");
  await b.joinedP;
  const marker = a.events.playback.length;
  a.socket.emit("player:ended", { videoId: V1, version: state.version });
  b.socket.emit("player:ended", { videoId: V1, version: state.version });
  await wait(500);
  const updates = a.events.playback.slice(marker);
  check(updates.length === 1, `double ENDED yields one advance (${updates.length})`);
  check(a.getState()?.currentVideoId === V2, "ENDED advanced to the next track");
  check(a.getState()?.version === state.version + 1, "ENDED bumped version once");
  a.socket.close();
  b.socket.close();
}

// --- queue cap ---------------------------------------------------------------
{
  const roomId = await createRoom();
  const seeded = Array.from({ length: 50 }, (_, i) => ({
    id: `seed-${i}`,
    videoId: "dQw4w9WgXcQ",
    url: "https://youtu.be/dQw4w9WgXcQ",
    title: `seed ${i}`,
    addedBy: "seed",
    addedAt: new Date().toISOString(),
  }));
  await redis.rpush(`room:${roomId}:queue`, ...seeded.map((t) => JSON.stringify(t)));
  const a = connect(roomId, "Alice", "client-a");
  await a.joinedP;
  a.socket.emit("queue:add", { url: "https://youtu.be/jNQXAC9IVRw" });
  await wait(1500);
  check(
    a.events.errors.some((e) => e.code === "QUEUE_FULL"),
    "queue cap of 50 enforced",
  );
  a.socket.close();
}

// --- room TTL: 24h while active, 30 min once empty ---------------------------
{
  const roomId = await createRoom();
  const a = connect(roomId, "Alice", "client-a");
  await a.joinedP;
  a.socket.emit("queue:add", { url: "https://youtu.be/dQw4w9WgXcQ" });
  await wait(1500);
  const activeTtl = await redis.ttl(`room:${roomId}`);
  check(
    activeTtl > 23 * 3600 && activeTtl <= 24 * 3600,
    `active room TTL ~24h (${activeTtl}s)`,
  );
  const activeQueueTtl = await redis.ttl(`room:${roomId}:queue`);
  check(
    activeQueueTtl > 23 * 3600,
    `active queue TTL ~24h (${activeQueueTtl}s)`,
  );
  a.socket.close();
  await wait(600);
  const emptyTtl = await redis.ttl(`room:${roomId}`);
  check(
    emptyTtl > 0 && emptyTtl <= 30 * 60,
    `empty room TTL ~30min (${emptyTtl}s)`,
  );
  const queueTtl = await redis.ttl(`room:${roomId}:queue`);
  check(queueTtl > 0 && queueTtl <= 30 * 60, `empty room queue TTL ~30min (${queueTtl}s)`);
}

console.log(failures === 0 ? "ROBUSTNESS SMOKE PASSED" : `FAILED: ${failures}`);
process.exitCode = failures === 0 ? 0 : 1;
redis.disconnect();
