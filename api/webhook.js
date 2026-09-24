// Telegram calls this URL for every new message (set up once via setWebhook).
// We answer Telegram immediately and do the slow AI work in the background,
// so Telegram never times out and re-sends the same note.

import { waitUntil } from '@vercel/functions';
import { sendMessage, downloadFile, extractMessage, isAllowedChat } from '../lib/telegram.js';
import { transcribe } from '../lib/gemini.js';
import { processNote } from '../lib/pipeline.js';
import { dbEnabled, findDraftForReview, setDraftStatus } from '../lib/db.js';

const HELP = `Send me a raw note: something that happened, something someone said, something you noticed.
Typed or voice note, both work.

I will:
1. Score it 0-10 (below 6 = no draft, with the reason)
2. Look for a current news angle
3. Draft a LinkedIn post in your voice

Reply APPROVE or REJECT to a draft to log your decision. I never post anything. You do.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, service: 'raghav-content-engine' });
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(401).json({ ok: false });
  }

  const msg = extractMessage(req.body || {});
  if (!msg || !isAllowedChat(msg.chat.id)) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  waitUntil(handleMessage(msg).catch((err) => reportError(msg, err)));
  return res.status(200).json({ ok: true });
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const reply = (text) => sendMessage(chatId, text, msg.message_id);

  // Ignore the bot's own posts echoing back in a channel.
  if (msg.from?.is_bot || msg.via_bot) return;

  const text = (msg.text || msg.caption || '').trim();

  if (/^\/(start|help)\b/i.test(text)) return reply(HELP);

  // Review gate: APPROVE / REJECT
  const decision = text.match(/^(approve|reject)\b/i)?.[1]?.toLowerCase();
  if (decision) {
    if (!dbEnabled()) return reply('Memory is not connected yet (Supabase). Decision not saved.');
    const draft = await findDraftForReview(String(chatId), msg.reply_to_message?.message_id);
    if (!draft) return reply('No pending draft found. Reply directly to the draft message.');
    const status = decision === 'approve' ? 'approved' : 'rejected';
    await setDraftStatus(draft.id, status);
    return reply(
      status === 'approved'
        ? '✓ Marked approved. Edit it, read it aloud once, then post it yourself on LinkedIn.'
        : '✗ Marked rejected. Kept in memory so we can see what the drafts get wrong.'
    );
  }

  // Voice note -> text
  const audio = msg.voice || msg.audio;
  if (audio) {
    const b64 = await downloadFile(audio.file_id);
    const transcript = await transcribe(b64, audio.mime_type || 'audio/ogg');
    await reply(`🎙 Transcript:\n${transcript}`);
    return processNote({ text: transcript, chatId, messageId: msg.message_id, source: 'voice', reply });
  }

  if (!text) return reply('Send text or a voice note.');
  return processNote({ text, chatId, messageId: msg.message_id, source: 'text', reply });
}

async function reportError(msg, err) {
  console.error(err);
  try {
    await sendMessage(msg.chat.id, `⚠ Something broke: ${err.message.slice(0, 300)}`, msg.message_id);
  } catch {}
}
