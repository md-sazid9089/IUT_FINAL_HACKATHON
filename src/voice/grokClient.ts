import { VOICE_SYSTEM_PROMPT } from './voicePrompt';

/**
 * Minimal Grok (xAI) client — same OpenAI-compatible chat/completions shape as
 * the public API. Optional fallback when a Grok key is configured; the panel
 * uses whichever provider has a key.
 *
 * SECURITY NOTE: as with the Gemini client, in production put this behind a
 * server-side proxy so the key never enters the browser bundle.
 */

export interface GrokOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly signal?: AbortSignal;
  /** Override for proxy or self-hosted endpoint. */
  readonly baseUrl?: string;
}

const DEFAULT_MODEL = 'grok-2-mini';
const DEFAULT_BASE = 'https://api.x.ai/v1';

interface GrokResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export async function callGrok(prompt: string, opts: GrokOptions): Promise<string> {
  if (!opts.apiKey) throw new Error('Missing Grok API key');
  const url = `${opts.baseUrl ?? DEFAULT_BASE}/chat/completions`;
  const body = {
    model: opts.model ?? DEFAULT_MODEL,
    temperature: 0,
    max_tokens: 256,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: VOICE_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  const json = (await res.json().catch(() => ({}))) as GrokResponse;
  if (!res.ok) {
    throw new Error(`Grok HTTP ${res.status}: ${json.error?.message ?? res.statusText}`);
  }
  const text = json.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Grok returned no content');
  return text;
}
