import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Provider for the chatbot, backed by Google Gemini (generous free tier).
// Reads the API key from GOOGLE_GENERATIVE_AI_API_KEY.
//
// Model is configurable via CHAT_MODEL. Defaults to Gemini 2.5 Flash —
// fast, free-tier friendly, a good fit for a public FAQ widget. For higher
// quality, set CHAT_MODEL to "gemini-3.5-flash" or "gemini-flash-latest".
export const DEFAULT_CHAT_MODEL = "gemini-2.5-flash";

export function createChatProvider(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey });
}
