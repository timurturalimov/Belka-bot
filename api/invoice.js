// api/invoice.js — создаёт ссылку на оплату столов в Telegram Stars (XTR).
// Клиент: POST /api/invoice { initData, tableId }  →  { link }
import crypto from 'node:crypto';
import { TABLE_TITLES, isValidTableId, priceFor } from '../lib/tablesCatalog.js';

// Проверка подписи Telegram: гарантирует, что userId в initData настоящий.
function verifyInitData(initData, botToken) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (calc !== hash) return null;
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > 24 * 3600) return null;
  try {
    return JSON.parse(params.get('user')).id;
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const token = process.env.BOT_TOKEN;
  const { initData, tableId } = req.body || {};
  const userId = verifyInitData(initData, token);
  if (!userId) return res.status(401).json({ error: 'bad_init_data' });
  if (!isValidTableId(tableId)) return res.status(400).json({ error: 'bad_table' });

  const title = tableId === 'all' ? 'Все столы' : `Стол «${TABLE_TITLES[tableId]}»`;
  const description = tableId === 'all'
    ? 'Откроет все столы в игре «Белка» навсегда.'
    : `Откроет стол «${TABLE_TITLES[tableId]}» в игре «Белка» навсегда.`;

  const tg = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description,
      payload: `${userId}:${tableId}`,
      provider_token: '',        // для Stars пусто
      currency: 'XTR',
      prices: [{ label: title, amount: priceFor(tableId) }]
    })
  }).then(r => r.json());

  if (!tg.ok) return res.status(502).json({ error: 'telegram', detail: tg.description });
  return res.status(200).json({ link: tg.result });
}
