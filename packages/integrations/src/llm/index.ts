/**
 * Anthropic Claude wrapper for narrative outputs (Daily Brief, recommendations).
 *
 * Discipline:
 *   - Output is ALWAYS structured JSON, validated by Zod.
 *   - Prompt cache is enabled on the system prompt (5min TTL).
 *   - Model selection per use-case: Haiku for short, Sonnet for nuanced narrative.
 *
 * AGENTS.md §14.4–§14.5.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  DAILY_BRIEF_PROMPT_VERSION,
  DAILY_BRIEF_SYSTEM_PROMPT,
  buildDailyBriefUserPrompt,
} from './prompts/daily-brief.js';
import type { DailyBriefFacts, DailyBriefOutput } from './prompts/daily-brief.js';

export type LlmConfig = {
  apiKey: string;
  dailyBriefModel?: string;
  menuScoreModel?: string;
};

const DAILY_BRIEF_OUTPUT_SCHEMA = z.object({
  greeting: z.string().min(1).max(200),
  highlights: z.array(z.string().max(120)).min(1).max(3),
  recommendation: z.object({
    title: z.string().min(1).max(120),
    detail: z.string().min(1).max(400),
    expectedImpact: z.string().min(1).max(160),
  }),
});

export type LlmGenerationMeta = {
  modelId: string;
  promptVersion: string;
  tokensInput: number;
  tokensOutput: number;
};

export class LlmClient {
  private readonly anthropic: Anthropic;

  constructor(private readonly cfg: LlmConfig) {
    this.anthropic = new Anthropic({ apiKey: cfg.apiKey });
  }

  async generateDailyBrief(
    facts: DailyBriefFacts,
  ): Promise<{ output: DailyBriefOutput; meta: LlmGenerationMeta }> {
    const model = this.cfg.dailyBriefModel ?? 'claude-haiku-4-5-20251001';

    // Prompt-cache the system block. SDK type variance across versions; the runtime
    // accepts the block-array form with cache_control. Tenants share this cache during
    // the nightly daily-brief burst (5min TTL).
    const cachedSystem = [
      {
        type: 'text',
        text: DAILY_BRIEF_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' as const },
      },
    ];

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: 800,
      system: cachedSystem as unknown as Parameters<typeof this.anthropic.messages.create>[0]['system'],
      messages: [{ role: 'user', content: buildDailyBriefUserPrompt(facts) }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let parsed: DailyBriefOutput;
    try {
      parsed = DAILY_BRIEF_OUTPUT_SCHEMA.parse(JSON.parse(extractJson(text)));
    } catch (err) {
      // One retry with a stricter instruction.
      const retry = await this.anthropic.messages.create({
        model,
        max_tokens: 800,
        system: DAILY_BRIEF_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: buildDailyBriefUserPrompt(facts) },
          { role: 'assistant', content: text },
          { role: 'user', content: 'Output sebelumnya tidak valid JSON. Kirim ulang HANYA JSON, tanpa teks lain.' },
        ],
      });
      const retryText = retry.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      parsed = DAILY_BRIEF_OUTPUT_SCHEMA.parse(JSON.parse(extractJson(retryText)));
      _ignore(err);
    }

    return {
      output: parsed,
      meta: {
        modelId: model,
        promptVersion: DAILY_BRIEF_PROMPT_VERSION,
        tokensInput: response.usage.input_tokens,
        tokensOutput: response.usage.output_tokens,
      },
    };
  }
}

function extractJson(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith('{')) return trimmed;
  // Strip markdown fence if present.
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  if (fence) return fence[1]!.trim();
  // Find first '{' to last '}'.
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON found in LLM output');
  return trimmed.slice(start, end + 1);
}

function _ignore(_e: unknown): void {
  /* swallow first attempt error */
}

export type { DailyBriefFacts, DailyBriefOutput };
export { DAILY_BRIEF_PROMPT_VERSION };
