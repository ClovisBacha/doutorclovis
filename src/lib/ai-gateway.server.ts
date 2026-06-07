import { createAnthropic } from "@ai-sdk/anthropic";

// Provider for the chatbot, backed directly by the Anthropic API
// (no Lovable gateway). Reads the API key from ANTHROPIC_API_KEY.
//
// Model is configurable via CHAT_MODEL. Defaults to Claude Haiku 4.5 —
// fast and cost-effective, a good fit for a public FAQ widget. For higher
// quality, set CHAT_MODEL to "claude-sonnet-4-6" or "claude-opus-4-8".
export const DEFAULT_CHAT_MODEL = "claude-haiku-4-5";

export function createAnthropicProvider(apiKey: string) {
  return createAnthropic({ apiKey });
}
