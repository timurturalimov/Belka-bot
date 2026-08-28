// lib/roomStore.js
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const ROOM_TTL_SECONDS = 3600; // комната живёт 1 час, если игра не началась

export async function createRoom(creatorChatId, creatorName) {
  const code = generateCode();
  const room = {
    code,
    players: [{ chatId: creatorChatId, name: creatorName }],
    status: 'waiting', // waiting | full | playing
    createdAt: Date.now()
  };
  await redis.set(`room:${code}`, JSON.stringify(room), { ex: ROOM_TTL_SECONDS });
  return room;
}

export async function getRoom(code) {
  const data = await redis.get(`room:${code}`);
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function joinRoom(code, chatId, name) {
  const room = await getRoom(code);
  if (!room) return { error: 'not_found' };
  if (room.status !== 'waiting') return { error: 'not_joinable' };
  if (room.players.some(p => p.chatId === chatId)) return { error: 'already_in' };

  room.players.push({ chatId, name });
  if (room.players.length === 4) {
    room.status = 'full';
  }
  await redis.set(`room:${code}`, JSON.stringify(room), { ex: ROOM_TTL_SECONDS });
  return { room };
}

export async function deleteRoom(code) {
  await redis.del(`room:${code}`);
}
