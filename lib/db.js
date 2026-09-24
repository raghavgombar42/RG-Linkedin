// Memory layer: Supabase over its REST API. Every function is a safe no-op
// until SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, so the L3 build
// works without a database and B1 switches it on by adding two env vars.

export const dbEnabled = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function saveNote(note) {
  if (!dbEnabled()) return null;
  const [row] = await rest('notes', { method: 'POST', body: note, prefer: 'return=representation' });
  return row;
}

export async function updateNote(id, fields) {
  if (!dbEnabled() || !id) return;
  await rest(`notes?id=eq.${id}`, { method: 'PATCH', body: fields });
}

export async function saveDraft(draft) {
  if (!dbEnabled()) return null;
  const [row] = await rest('drafts', { method: 'POST', body: draft, prefer: 'return=representation' });
  return row;
}

// Finds the draft Raghav is replying to; falls back to his latest pending draft.
export async function findDraftForReview(chatId, replyToMessageId) {
  if (!dbEnabled()) return null;
  if (replyToMessageId) {
    const rows = await rest(
      `drafts?chat_id=eq.${chatId}&telegram_message_id=eq.${replyToMessageId}&select=*&limit=1`
    );
    if (rows.length) return rows[0];
  }
  const rows = await rest(
    `drafts?chat_id=eq.${chatId}&status=eq.pending&select=*&order=created_at.desc&limit=1`
  );
  return rows[0] || null;
}

export async function setDraftStatus(id, status) {
  await rest(`drafts?id=eq.${id}`, {
    method: 'PATCH',
    body: { status, reviewed_at: new Date().toISOString() },
  });
}

// Latest active voice skill stored in Supabase, if any. Lets Raghav version
// his voice without redeploying. Falls back to voice-skill.txt.
export async function getActiveVoiceSkill() {
  if (!dbEnabled()) return null;
  try {
    const rows = await rest('voice_skill?is_active=eq.true&select=version,content&order=created_at.desc&limit=1');
    return rows[0] || null;
  } catch {
    return null;
  }
}
