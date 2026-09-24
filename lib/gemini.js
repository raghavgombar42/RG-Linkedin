// Gemini via the REST API (no SDK, so nothing breaks when the SDK changes).

const model = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function generate({ system, parts, json = false, temperature = 0.7 }) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model()}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new Error('Gemini returned an empty response');
  return text.trim();
}

export async function geminiText(system, prompt, temperature = 0.7) {
  return generate({ system, parts: [{ text: prompt }], temperature });
}

export async function geminiJSON(system, prompt) {
  const text = await generate({ system, parts: [{ text: prompt }], json: true, temperature: 0.2 });
  return JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
}

export async function transcribe(base64Audio, mimeType = 'audio/ogg') {
  return generate({
    parts: [
      { inline_data: { mime_type: mimeType, data: base64Audio } },
      {
        text:
          'Transcribe this voice note exactly as spoken. Keep Hindi/Hinglish words as spoken, written in Roman script. ' +
          'No summary, no commentary, no timestamps. Return only the transcript.',
      },
    ],
    temperature: 0,
  });
}

export const geminiModelName = model;
