// B1 final step: run the same note through Gemini and Claude, side by side.
//   npm run compare -- "your note here"
// Needs GEMINI_API_KEY and ANTHROPIC_API_KEY in .env.

import { writeDraft, findNews } from '../lib/pipeline.js';

const text = process.argv.slice(2).join(' ').trim();
if (!text) {
  console.error('Usage: npm run compare -- "your note here"');
  process.exit(1);
}

const { news } = await findNews(text);
console.log('News item:', news ? `${news.headline} (${news.source})` : 'none');

const [g, c] = await Promise.all([
  writeDraft(text, news, null, 'gemini'),
  writeDraft(text, news, null, 'claude'),
]);

for (const d of [g, c]) {
  console.log(`\n════════ ${d.model} · news used: ${d.newsUsed} · ${d.body.split(/\s+/).length} words ════════\n`);
  console.log(d.body);
}
console.log('\nNow write ONE sentence: what changed between the two?');
