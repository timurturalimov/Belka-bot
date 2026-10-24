// api/webhook.js
import { createRoom, getRoom, joinRoom } from '../lib/roomStore.js';
import { FIREBASE_DB_URL, TABLE_TITLES, isValidTableId } from '../lib/tablesCatalog.js';

async function sendMessage(chatId, text) {
  const token = process.env.BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function tgCall(method, body) {
  const token = process.env.BOT_TOKEN;
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function roomStatusText(room) {
  const names = room.players.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  return `Комната ${room.code}\nИгроков: ${room.players.length}/4\n${names}`;
}

// payload счёта: "<userId>:<tableId>" (tableId = id стола или "all")
function parsePayload(payload) {
  const [userId, tableId] = String(payload || '').split(':');
  if (!userId || !isValidTableId(tableId)) return null;
  return { userId, tableId };
}

// Telegram ждёт ответ на pre_checkout_query не дольше 10 секунд, иначе платёж не пройдёт.
async function handlePreCheckout(query) {
  const parsed = parsePayload(query.invoice_payload);
  const ok = !!parsed && parsed.userId === String(query.from.id);
  await tgCall('answerPreCheckoutQuery', ok
    ? { pre_checkout_query_id: query.id, ok: true }
    : { pre_checkout_query_id: query.id, ok: false, error_message: 'Не удалось проверить покупку. Попробуй ещё раз.' });
}

// Оплата прошла: пишем покупку в Firebase (purchases/<userId>/<tableId>) — игра читает её оттуда.
async function handleSuccessfulPayment(message) {
  const pay = message.successful_payment;
  const parsed = parsePayload(pay.invoice_payload);
  if (!parsed) return;
  const record = {
    at: Date.now(),
    stars: pay.total_amount,
    chargeId: pay.telegram_payment_charge_id   // нужен для возврата Stars
  };
  const url = `${FIREBASE_DB_URL}/purchases/${parsed.userId}/${parsed.tableId}.json`;
  const r = await fetch(url, { method: 'PUT', body: JSON.stringify(record) });
  if (!r.ok) throw new Error('firebase_write_failed ' + r.status);
  const what = parsed.tableId === 'all' ? 'все столы' : `стол «${TABLE_TITLES[parsed.tableId]}»`;
  await sendMessage(message.chat.id, `Спасибо! Открыто: ${what}. Выбрать стол можно в Настройках.`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is running');
  }

  const update = req.body || {};

  try {
    if (update.pre_checkout_query) {
      await handlePreCheckout(update.pre_checkout_query);
      return res.status(200).send('ok');
    }
    if (update.message?.successful_payment) {
      await handleSuccessfulPayment(update.message);
      return res.status(200).send('ok');
    }
  } catch (err) {
    // 500 → Telegram повторит доставку, запись в Firebase идемпотентна (PUT).
    return res.status(500).send('payment_error');
  }

  const message = update.message;
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
