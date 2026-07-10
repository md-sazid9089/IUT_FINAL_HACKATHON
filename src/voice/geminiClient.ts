import { VOICE_SYSTEM_PROMPT } from './voicePrompt';

/**
 * Minimal Gemini REST client for browser use. It talks to the "generateContent"
 * endpoint with a strict system instruction (see voicePrompt.ts) and returns
 * the model's raw JSON text — validation happens in the parser.
 *
 * SECURITY NOTE: Vite inlines `VITE_*` at build time, so any key set in `.env`
 * is embedded in the shipped bundle. For a real deployment, proxy this call
 * through a small server and keep the key server-side. This client is designed
 * so swapping the fetch URL/headers to your proxy is a one-line change.
 */

export interface GeminiOptions {
  readonly apiKey: string;
  /** Model id; defaults to a fast, low-cost text model that supports JSON. */
  readonly model?: string;
  /** Optional AbortSignal so the UI can cancel a slow request. */
  readonly signal?: AbortSignal;
}

const DEFAULT_MODEL = 'gemini-1.5-flash-latest';

interface GeminiCandidatePart {
  text?: string;
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiCandidatePart[] } }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

export async function callGemini(prompt: string, opts: GeminiOptions): Promise<string> {
  if (!opts.apiKey) throw new Error('Missing Gemini API key');
  const model = opts.model ?? DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;

  const body = {
    systemInstruction: { role: 'system', parts: [{ text: VOICE_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      candidateCount: 1,
      maxOutputTokens: 256,
    },
    safetySettings: [],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });

  const json = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${json.error?.message ?? res.statusText}`);
  }
  if (json.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the prompt: ${json.promptFeedback.blockReason}`);
  }
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini returned no content');
  return text;
}
