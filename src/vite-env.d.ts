/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Gemini API key (Web-Speech AI parser). Baked in at build time — use
   * a server proxy for production. */
  readonly VITE_GEMINI_API_KEY?: string;
  /** xAI Grok API key. Optional fallback when Gemini is not configured. */
  readonly VITE_GROK_API_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
