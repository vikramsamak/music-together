// Phase 3 smoke test: queue + server-authoritative playback sync.
// Usage: node scripts/playback-smoke.mjs   (API must be running on :3001)
import { io } from "socket.io-client";

const API = process.env.API_URL ?? "http://localhost:3001";
const V1 = "dQw4w9WgXcQ";
const V2 = "jNQXAC9IVRw";

let failures = 0;
function check(cond, label) {
  console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures += 1;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(roomId, name, clientId) {
  const socket = io(API, { transports: ["websocket"] });
  const events = { queue: [], playback: [], errors: [] };
  let lastState = null;
  const joinedP = new Promise((resolve, reject) => {
    socket.on("joined", resolve);
    socket.on("error", reject);
    setTimeout(() => reject(new Error(`${name}: join timeout`)), 5000);
  });
  socket.on("queue:update", (d) => events.queue.push(d.queue));
  socket.on("playback:update", (d) => {
    lastState = d.state;
    events.playback.push(d);
  });
  socket.on("error", (e) => events.errors.push(e));
  socket.emit("join", { roomId, name, clientId });
  return { socket, events, joinedP, getState: () => lastState };
}

const res = await fetch(`${API}/api/rooms`, { method: "POST" });
const roomId = (await res.json()).roomId;

const a = connect(roomId, "Alice", "client-a");
const aJoined = await a.joinedP;
check(aJoined.queue.length === 0, "A joins with empty queue");
check(aJoined.playback.currentVideoId === "", "A joins with no current video");
check(aJoined.playback.version === 0, "A joins at version 0");

a.socket.emit("queue:add", { url: `https://www.youtube.com/watch?v=${V1}` });
await wait(1500);
check(a.events.queue.at(-1)?.length === 1, "queue:add adds a track");
const t1 = a.events.queue.at(-1)?.[0];
check(!!t1?.title, `track title resolved (${t1?.title})`);
const afterAdd = a.getState();
check(afterAdd?.currentVideoId === V1, "first track becomes current");
check(afterAdd?.playing === false, "current track starts paused");
check(afterAdd?.currentTrackId === t1?.id, "currentTrackId matches first track");

const b = connect(roomId, "Bob", "client-b");
const bJoined = await b.joinedP;
check(bJoined.queue.length === 1, "late joiner B sees the queue");
check(bJoined.playback.currentVideoId === V1, "late joiner B sees current track");

b.socket.emit("player:play");
await wait(300);
check(b.getState()?.playing === true, "B play -> playing true broadcast");
await wait(1200);
b.socket.emit("player:pause");
await wait(300);
const paused = b.getState();
check(paused?.playing === false, "B pause -> playing false broadcast");
check(paused?.position >= 1, `paused position advanced (${paused?.position.toFixed(2)}s)`);
check(paused?.version > afterAdd.version, "version increments on playback change");

a.socket.emit("player:seek", { position: 30 });
await wait(300);
check(a.getState()?.position === 30, "seek updates the shared position");

a.socket.emit("queue:add", {
  url: `https://music.youtube.com/watch?v=${V2}&feature=share`,
});
await wait(1500);
check(a.events.queue.at(-1)?.length === 2, "music.youtube.com link parses to a track");
a.socket.emit("player:next");
await wait(300);
const nextState = a.getState();
check(nextState?.currentVideoId === V2, "next advances to the second track");
check(nextState?.position === 0, "next resets position to 0");

const staleVersion = nextState.version - 1;
a.socket.emit("player:ended", { videoId: V2, version: staleVersion });
await wait(250);
check(
  a.getState()?.version === nextState.version,
  "stale-end guard: outdated version is ignored",
);

a.socket.emit("player:ended", { videoId: V2, version: nextState.version });
await wait(300);
const endedState = a.getState();
check(endedState?.playing === false, "end of queue stops playback");
check(endedState?.version === nextState.version + 1, "end advance bumps version once");

a.socket.emit("queue:add", { url: "https://example.com/not-a-video" });
await wait(300);
check(
  a.events.errors.some((e) => e.code === "BAD_VIDEO"),
  "non-YouTube URL rejected with BAD_VIDEO",
);

a.socket.emit("queue:remove", { trackId: t1.id });
await wait(300);
check(a.events.queue.at(-1)?.length === 1, "queue:remove deletes the track");
check(a.getState()?.currentVideoId === V2, "removing a non-current track keeps playback");

console.log(failures === 0 ? "PLAYBACK SMOKE PASSED" : `FAILED: ${failures}`);
process.exitCode = failures === 0 ? 0 : 1;
a.socket.close();
b.socket.close();
