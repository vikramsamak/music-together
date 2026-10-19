// Phase 1 smoke test: create a room, join with two WS clients, assert presence.
// Usage: node scripts/ws-smoke.mjs   (API must be running on :3001)
import { io } from 'socket.io-client';

const API = process.env.API_URL ?? 'http://localhost:3001';

async function createRoom() {
  const res = await fetch(`${API}/api/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error(`POST /api/rooms failed: ${res.status}`);
  return (await res.json()).roomId;
}

function connect(roomId, name, clientId) {
  const socket = io(API, { transports: ['websocket'] });
  const events = [];
  socket.on('presence:update', (d) => events.push(['presence:update', d]));
  socket.on('joined', (d) => events.push(['joined', d]));
  socket.on('error', (d) => events.push(['error', d]));
  const joined = new Promise((resolve, reject) => {
    socket.on('joined', resolve);
    socket.on('error', reject);
    setTimeout(() => reject(new Error(`${name}: join timeout`)), 5000);
  });
  socket.emit('join', { roomId, name, clientId });
  return { socket, events, joined };
}

const roomId = await createRoom();
console.log('room:', roomId);

const a = connect(roomId, 'Alice', 'client-a');
const b = connect(roomId, 'Bob', 'client-b');
await a.joined;
await b.joined;
await new Promise((r) => setTimeout(r, 500));

const lastA = a.events.filter(([e]) => e === 'presence:update').pop();
const lastB = b.events.filter(([e]) => e === 'presence:update').pop();
console.log('A presence:', JSON.stringify(lastA?.[1]));
console.log('B presence:', JSON.stringify(lastB?.[1]));
console.log('A joined snapshot members:', JSON.stringify((await a.joined).members));

const names = (lastA?.[1]?.members ?? []).map((m) => m.name).sort();
if (names.length === 2 && names.includes('Alice') && names.includes('Bob')) {
  console.log('SMOKE TEST PASSED');
} else {
  console.error('SMOKE TEST FAILED');
  process.exitCode = 1;
}
a.socket.close();
b.socket.close();
