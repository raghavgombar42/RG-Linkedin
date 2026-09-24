// The whole engine: Trigger -> Input -> Context -> Processing -> AI -> Output.
// Kept free of Telegram specifics so scripts/test-note.mjs can run it locally.

import { geminiJSON, geminiText, geminiModelName } from './gemini.js';
import { claudeText, claudeModelName } from './claude.js';
import { fetchTopNews } from './news.js';
import { saveNote, updateNote, saveDraft, getActiveVoiceSkill } from './db.js';
import {
  VOICE_SKILL_FILE,
  SCORING_SYSTEM,
  KEYWORDS_SYSTEM,
  draftSystem,
  draftPrompt,
} from './prompts.js';

const MIN_SCORE = () => Number(process.env.MIN_SCORE || 6);

export function draftProvider() {
  const forced = (process.env.DRAFT_PROVIDER || '').toLowerCase();
  if (forced === 'claude' || forced === 'gemini') return forced;
  return process.env.ANTHROPIC_API_KEY ? 'claude' : 'gemini';
}

// Processing: publishability triage.
export async function scoreNote(text) {
  const r = await geminiJSON(SCORING_SYSTEM, `Note:\n"""\n${text}\n"""`);
  return {
    score: Math.max(0, Math.min(10, Math.round(Number(r.score) || 0))),
    reason: String(r.reason || '').trim(),
    archetype: r.archetype && r.archetype !== 'none' ? r.archetype : null,
    topic: r.topic || 'other',
  };
}

// Context: find a current news item. Never fatal; a draft without news is fine.
export async function findNews(text) {
  try {
    const { query } = await geminiJSON(KEYWORDS_SYSTEM, `Note:\n"""\n${text}\n"""`);
    if (!query) return { query: null, news: null };
    return { query, news: await fetchTopNews(query) };
  } catch (err) {
    console.error('News step failed:', err.message);
    return { query: null, news: null };
  }
}

// AI: write the draft in Raghav's voice.
export async function writeDraft(text, news, archetype, provider = draftProvider()) {
  const stored = await getActiveVoiceSkill();
  const voice = stored?.content || VOICE_SKILL_FILE;
  const system = draftSystem(voice);
  const prompt = draftPrompt(text, news, archetype);

  const raw =
    provider === 'claude' ? await claudeText(system, prompt) : await geminiText(system, prompt, 0.8);

  const newsUsed = /NEWS_USED:\s*YES/i.test(raw) && Boolean(news);
  const body = raw.replace(/\n*NEWS_USED:\s*(YES|NO)\s*$/i, '').trim();
  return {
    body,
    newsUsed,
    model: provider === 'claude' ? claudeModelName() : geminiModelName(),
    voiceVersion: stored?.version || 'file:v1.0',
  };
}

export function verifyBlock(news) {
  const line = '─────────────────────────────────';
  return [
    line,
    `NEWS SOURCE: ${news.headline}`,
    `FROM: ${news.source} · ${news.date}`,
    `LINK: ${news.link}`,
    '⚠ Check this before publishing — you are the author of this claim',
    line,
  ].join('\n');
}

/**
 * Runs one note end to end.
 * @param {object} p
 * @param {string} p.text        the note (typed, or transcribed from voice)
 * @param {string|number} p.chatId
 * @param {number} [p.messageId] Telegram message id of the note
 * @param {string} [p.source]    'text' | 'voice'
 * @param {(text: string) => Promise<{message_id?: number}|void>} p.reply
 */
export async function processNote({ text, chatId, messageId, source = 'text', reply }) {
  const note = await saveNote({
    chat_id: String(chatId),
    telegram_message_id: messageId ?? null,
    source,
    content: text,
    status: 'received',
  });

  // 1. Score
  const s = await scoreNote(text);
  await updateNote(note?.id, { score: s.score, score_reason: s.reason, topic: s.topic, archetype: s.archetype });

  if (s.score < MIN_SCORE()) {
    await updateNote(note?.id, { status: 'rejected' });
    await reply(
      `✗ No draft · score ${s.score}/10\n${s.reason}\n\n` +
        `Saved for later. If there's a real moment behind this, send it again with the details: who, where, what was said.`
    );
    return { status: 'rejected', ...s };
  }

  // 2. News hook
  const { query, news } = await findNews(text);

  // 3. Draft
  const d = await writeDraft(text, news, s.archetype);
  const header = `✓ Draft · score ${s.score}/10${s.archetype ? ` · archetype ${s.archetype}` : ''} · ${d.model}`;
  const parts = [header, '', d.body];
  if (d.newsUsed) parts.push('', verifyBlock(news));
  parts.push('', 'Reply APPROVE or REJECT to this message. Nothing is posted anywhere until you post it.');

  const sent = await reply(parts.join('\n'));

  await updateNote(note?.id, { status: 'drafted' });
  await saveDraft({
    note_id: note?.id ?? null,
    chat_id: String(chatId),
    telegram_message_id: sent?.message_id ?? null,
    content: d.body,
    model: d.model,
    voice_version: d.voiceVersion,
    news_query: query,
    news_headline: d.newsUsed ? news.headline : null,
    news_source: d.newsUsed ? news.source : null,
    news_url: d.newsUsed ? news.link : null,
    status: 'pending',
  });

  return { status: 'drafted', score: s, news: d.newsUsed ? news : null, draft: d.body };
}
