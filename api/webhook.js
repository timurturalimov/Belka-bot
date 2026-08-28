// api/webhook.js
import { createRoom, getRoom, joinRoom } from '../lib/roomStore.js';

async function sendMessage(chatId, text) {
  const token = process.env.BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

function roomStatusText(room) {
  const names = room.players.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  return `Комната ${room.code}\nИгроков: ${room.players.length}/4\n${names}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is running');
  }

  const message = req.body?.message;
  if (!message) {
    return res.status(200).send('ok');
  }

  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const name = message.from?.first_name || 'Игрок';

  try {
    if (text === '/start') {
      await sendMessage(chatId, 'Привет! Команды:\n/create — создать комнату\n/join КОД — присоединиться');
    } else if (text === '/create') {
      const room = await createRoom(chatId, name);
      await sendMessage(chatId, `Комната создана!\nКод: ${room.code}\nОтправь его друзьям, чтобы они написали:\n/join ${room.code}\n\n${roomStatusText(room)}`);
    } else if (text.startsWith('/join')) {
      const parts = text.split(' ');
      const code = (parts[1] || '').toUpperCase();
      if (!code) {
        await sendMessage(chatId, 'Укажи код: /join КОД');
      } else {
        const result = await joinRoom(code, chatId, name);
        if (result.error === 'not_found') {
          await sendMessage(chatId, 'Комната с таким кодом не найдена.');
        } else if (result.error === 'not_joinable') {
          await sendMessage(chatId, 'Комната уже заполнена или игра началась.');
        } else if (result.error === 'already_in') {
          await sendMessage(chatId, 'Ты уже в этой комнате.');
        } else {
          const room = result.room;
          for (const player of room.players) {
            const full = room.players.length === 4;
            const msg = full
              ? `Стол собран! ${roomStatusText(room)}\n\nСкоро начнём раздачу.`
              : `${name} присоединился.\n${roomStatusText(room)}`;
            await sendMessage(player.chatId, msg);
          }
        }
      }
    } else {
      await sendMessage(chatId, `Ты написал: ${text}`);
    }
  } catch (err) {
    await sendMessage(chatId, 'Что-то пошло не так: ' + err.message);
  }

  return res.status(200).send('ok');
}
