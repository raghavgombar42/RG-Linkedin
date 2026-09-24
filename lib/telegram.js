// Thin wrapper around the Telegram Bot API.

const api = (method) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

export async function sendMessage(chatId, text, replyTo) {
  const res = await fetch(api('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4096),
      disable_web_page_preview: true,
      ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendMessage failed: ${data.description}`);
  return data.result; // the sent Message, incl. message_id
}

// Downloads a voice note / audio file and returns it as base64.
export async function downloadFile(fileId) {
  const meta = await (await fetch(api(`getFile?file_id=${encodeURIComponent(fileId)}`))).json();
  if (!meta.ok) throw new Error(`Telegram getFile failed: ${meta.description}`);
  const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${meta.result.file_path}`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  return buf.toString('base64');
}

// Notes can arrive as a DM to the bot (`message`) or as a post in the
// private capture channel (`channel_post`). Handle both the same way.
export function extractMessage(update) {
  return update.message || update.channel_post || null;
}

export function isAllowedChat(chatId) {
  const allowed = (process.env.TELEGRAM_CHAT_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // No allowlist configured: accept everything (handy for first test, not for real use).
  return allowed.length === 0 || allowed.includes(String(chatId));
}
