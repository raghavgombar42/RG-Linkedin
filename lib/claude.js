// Claude via the Messages REST API. Used for drafting from B1 onwards.

export const claudeModelName = () => process.env.CLAUDE_MODEL || 'claude-sonnet-5';

export async function claudeText(system, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: claudeModelName(),
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude error ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}
