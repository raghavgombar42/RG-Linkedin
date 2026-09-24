# Raghav's Content Engine

A Telegram note goes in. A LinkedIn draft in my voice comes back. **I still hit post.**

```
Raghav ──note/voice──▶ Telegram ──webhook──▶ Vercel /api/webhook
                                               │
                         Gemini Flash: score 0–10 ──<6──▶ "no draft, here's why"
                                               │ ≥6
                         Gemini: keywords ──▶ Google News RSS (headline, source, link)
                                               │
                         Claude/Gemini + voice-skill.txt ──▶ draft (+ verify block)
                                               │
                         Telegram ◀── draft ── Supabase (notes, drafts, status)
                                               │
                         Raghav: APPROVE / REJECT → edits → posts on LinkedIn himself
```

## Files

| File | What it does |
|---|---|
| `api/webhook.js` | The URL Telegram calls. Answers straight away and processes in the background. Handles APPROVE/REJECT, voice notes and /start. |
| `lib/pipeline.js` | The engine: save → score → news → draft → send → save. |
| `lib/prompts.js` | Scoring prompt, keyword prompt, drafting prompt. **Where the voice skill enters the model: `draftSystem()`.** |
| `lib/gemini.js` / `lib/claude.js` | Model calls (plain REST, no SDKs). |
| `lib/news.js` | Google News RSS: free, no key. |
| `lib/db.js` | Supabase memory. Does nothing until the Supabase env vars are set. |
| `lib/telegram.js` | Send messages, download voice notes, allowlist. |
| `voice-skill.txt` | Raghav Gombar Voice Skill v1.0. Sent to the model on every draft. |
| `founder-context.txt` | Background facts. Reference only. |
| `public/index.html` | The landing page (the Vercel URL you submit). |
| `supabase/schema.sql` | The three tables for B1. |
| `test-notes.md` | Notes that should pass and notes that should fail. |

## Setup, step by step

### 1. Telegram (on your phone)
1. Search **@BotFather** (blue tick) → `/newbot` → pick a name → pick a username ending in `bot`.
2. Copy the **bot token**. Treat it like a password.
3. New Channel → name it "Content Captures" → **Private**.
4. Channel info → Administrators → Add Admin → your bot → turn on **Post Messages** only → Save.
5. Post "test" in the channel. Forward it to **@userinfobot**. Copy the "Forwarded from" id (it starts with `-100`). This is `TELEGRAM_CHAT_ID`.
   - Want to DM the bot as well? Message @userinfobot directly to get your own user id, and put both in: `-100123...,98765...`

### 2. Gemini key
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) → Create API key.

### 3. Local `.env`
Copy `.env.example` to `.env` and fill in `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY` and `TELEGRAM_CHAT_ID`. `.env` is gitignored.

Optional local test, no Telegram needed:
```bash
npm install
npm run test-note -- "Ordered 4 Cokes on Blinkit. 6 showed up."
```

### 4. GitHub
Create an empty **private** repo on github.com called `raghav-content-engine`, then:
```bash
git remote add origin https://github.com/<you>/raghav-content-engine.git
git push -u origin main
```

### 5. Vercel
vercel.com → Add New → Project → import the repo → Framework preset **Other** → open **Environment Variables** and add every variable from your `.env` → Deploy. Copy the production URL.

### 6. Connect Telegram to Vercel (once)
Paste this in a browser, with your values:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-app>.vercel.app/api/webhook
```
You should see `"ok":true`. To check it later: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.

If you set `TELEGRAM_WEBHOOK_SECRET`, add `&secret_token=<that value>` to the URL.

### 7. Test
Post test note 1 from `test-notes.md` in the channel. Within about 10 seconds you should get a score line and a draft. Then post test note 5, which should come back as "No draft".

## B1 (25 Sept)

- **Scoring**: already built (`MIN_SCORE=6`). Test one strong note and one weak note. If both pass, tighten `SCORING_SYSTEM` in `lib/prompts.js`.
- **News angle**: already built. The draft ends with the NEWS SOURCE / LINK / ⚠ block whenever news was used.
- **Memory**: create a Supabase project → SQL Editor → run `supabase/schema.sql` → add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel → Redeploy. Send a note, check the tables, then reply `APPROVE` to the draft and check again.
- **Model comparison**: add `ANTHROPIC_API_KEY` to `.env`, then run `npm run compare -- "<note>"`. Write one sentence on what changed. Add the key in Vercel as well, and drafting switches to Claude.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Bot silent in the channel | Is the bot an admin with Post Messages? Does `getWebhookInfo` show your Vercel URL? Does `TELEGRAM_CHAT_ID` match (including `-100`)? |
| `getWebhookInfo` shows `last_error_message` | Read it. A 401 means the secret token doesn't match. A 404 means the wrong URL (it must end in `/api/webhook`). |
| "Gemini error 404 model not found" | Set `GEMINI_MODEL` to the current Flash model name listed in AI Studio. |
| Drafts sound generic | Check the `voice-skill.txt` contents reach `draftSystem()` in `lib/prompts.js`. |
| Env var changes not applied | Vercel → Deployments → Redeploy. Env vars only apply to new deployments. |
