/**
 * Provider-neutral adapter registry. Cloudflare Workers AI is the first
 * provider; future providers (Gemini, OpenAI-compatible endpoints, etc.) only
 * need to implement the same `AiProvider` interface.
 */

import { CloudflareProvider } from "./cloudflare-client";
import { getLiaConfig } from "./config";
import type { AiProvider } from "./types";

export function getAiProvider(): AiProvider {
  const config = getLiaConfig();
  switch (config.provider) {
    case "cloudflare":
      return new CloudflareProvider(config);
    default: {
      const exhaustive: never = config.provider;
      throw new Error(`Provider AI tidak dikenal: ${String(exhaustive)}`);
    }
  }
}
