export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is running');
  }

  const message = req.body?.message;
  if (!message) {
    return res.status(200).send('ok');
  }

  const chatId = message.chat.id;
  const text = message.text || '';

  const token = process.env.BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `Ты написал: ${text}`
    })
  });

  return res.status(200).send('ok');
}
