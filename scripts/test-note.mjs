// Run one note through the pipeline on your laptop, without Telegram.
//   npm run test-note -- "We ordered 4 Cokes from Blinkit. 6 showed up..."
// Needs GEMINI_API_KEY in .env (Supabase is skipped unless configured).

import { processNote } from '../lib/pipeline.js';

const text = process.argv.slice(2).join(' ').trim();
if (!text) {
  console.error('Usage: npm run test-note -- "your note here"');
  process.exit(1);
}

const result = await processNote({
  text,
  chatId: 'local-test',
  reply: async (msg) => {
    console.log('\n──────── BOT WOULD SEND ────────\n' + msg + '\n');
    return {};
  },
});
console.log('Result status:', result.status);
