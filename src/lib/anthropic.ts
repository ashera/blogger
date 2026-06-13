import "server-only";
import { logApiInfo } from "@/lib/error-log";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 1500;

// Retry config for transient failures (rate limits / overload). The
// per-minute token limits reset each minute, so honouring the server's
// retry-after lets a generation wait out the window instead of failing.
const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 503, 529]);
const MAX_BACKOFF_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * How long to wait before the next attempt. Prefers the server's
 * `retry-after` (seconds) — authoritative for the per-minute token window —
 * then falls back to exponential backoff with jitter. Capped so a server
 * action never blocks unreasonably long.
 */
function retryDelayMs(headers: Headers, attempt: number): number {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs >= 0) {
      return Math.min(secs * 1000 + 250, MAX_BACKOFF_MS);
    }
  }
  const base = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
  return base + Math.floor(base * 0.25 * Math.random());
}

// Server-managed tool definitions. Tool versions evolve — bump if Anthropic
// publishes a newer one and the API rejects these.
export const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 3,
} as const;

export const WEB_FETCH_TOOL = {
  type: "web_fetch_20260309",
  name: "web_fetch",
  max_uses: 3,
  // Cap how much of each fetched page is pulled into context. Whole pages
  // can be tens of thousands of tokens; without this, three fetches can
  // blow the per-minute input-token budget on their own.
  max_content_tokens: 5000,
} as const;

export type Message = { role: "user" | "assistant"; content: string };

export type Tool = Record<string, unknown>;

export type ToolChoice =
  | { type: "auto" }
  | { type: "any" }
  | { type: "tool"; name: string };

/**
 * System prompt: either a plain string (simple case) or an array of content
 * blocks. Use the array form when you want to attach cache_control to a
 * specific block — Anthropic prompt caching reuses identical prefixes
 * across calls within a 5-minute TTL, charging 10% of normal input cost
 * for cached tokens (and counting at 10% against ITPM).
 */
export type SystemContentBlock = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

export type CallOpts = {
  system: string | SystemContentBlock[];
  messages: Message[];
  model?: string;
  maxTokens?: number;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  /** Optional metadata for the info log written on each call. */
  logMeta?: { context?: string; userId?: string | null; seedId?: string | null };
};

export type ToolUseBlock = {
  id: string;
  name: string;
  input: unknown;
};

export type CallResult =
  | {
      ok: true;
      text: string;
      model: string;
      toolUses: ToolUseBlock[];
      stopReason: string | null;
      raw: unknown;
    }
  | { ok: false; error: string };

/** Single-turn (or short multi-turn) call to the Anthropic Messages API. */
export async function callClaude(opts: CallOpts): Promise<CallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY not configured" };
  }
  const model = opts.model ?? DEFAULT_MODEL;
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: opts.system,
    messages: opts.messages,
  };
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
  }
  if (opts.toolChoice) {
    body.tool_choice = opts.toolChoice;
  }
  const payload = JSON.stringify(body);

  const startedAt = Date.now();
  const ctx = opts.logMeta?.context ?? "messages";
  let lastError = "Anthropic request failed";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": API_VERSION,
          "content-type": "application/json",
        },
        body: payload,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => `${res.status}`);
        lastError = `Anthropic ${res.status}: ${detail}`;
        // Rate-limited / transiently overloaded: wait out the window and
        // retry rather than failing the whole generation.
        if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
          const wait = retryDelayMs(res.headers, attempt);
          // eslint-disable-next-line no-console
          console.warn(
            `[anthropic] ${res.status} (attempt ${attempt + 1}/${
              MAX_RETRIES + 1
            }) — retrying in ${Math.round(wait / 1000)}s`,
          );
          await sleep(wait);
          continue;
        }
        return { ok: false, error: lastError };
      }
      const json = (await res.json()) as {
        content?: Array<{
          type: string;
          text?: string;
          id?: string;
          name?: string;
          input?: unknown;
        }>;
        stop_reason?: string;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          cache_read_input_tokens?: number;
          cache_creation_input_tokens?: number;
        };
      };
      const blocks = json.content ?? [];
      // Server-managed tools (web_search, web_fetch) emit non-text content
      // blocks (server_tool_use, web_search_tool_result, etc.) inline. We
      // ignore those and just return the model's final text + any
      // client-side tool_use blocks the caller asked for.
      const text = blocks
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("")
        .trim();
      const toolUses: ToolUseBlock[] = blocks
        .filter((b) => b.type === "tool_use" && b.id && b.name)
        .map((b) => ({
          id: b.id as string,
          name: b.name as string,
          input: b.input,
        }));
      if (!text && toolUses.length === 0) {
        return { ok: false, error: "Empty response from Anthropic" };
      }
      const durationMs = Date.now() - startedAt;
      const usage = json.usage ?? {};
      await logApiInfo({
        source: "anthropic",
        context: ctx,
        userId: opts.logMeta?.userId ?? null,
        seedId: opts.logMeta?.seedId ?? null,
        durationMs,
        message: `${model} · ${usage.input_tokens ?? "?"} in / ${
          usage.output_tokens ?? "?"
        } out · ${json.stop_reason ?? "?"}`,
        detail: JSON.stringify(
          {
            endpoint: "POST /v1/messages",
            model,
            maxTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
            messages: opts.messages.length,
            tools: (opts.tools ?? []).map((t) => (t as { name?: string }).name ?? "?"),
            stopReason: json.stop_reason ?? null,
            usage,
            attempts: attempt + 1,
            durationMs,
          },
          null,
          2,
        ),
      });
      return {
        ok: true,
        text,
        model,
        toolUses,
        stopReason: json.stop_reason ?? null,
        raw: json,
      };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      // Network-level error: back off and retry too.
      if (attempt < MAX_RETRIES) {
        await sleep(retryDelayMs(new Headers(), attempt));
        continue;
      }
      return { ok: false, error: lastError };
    }
  }
  return { ok: false, error: lastError };
}

export type PingResult = {
  latencyMs: number;
  model: string;
  keyConfigured: boolean;
};

/**
 * Cheapest possible round-trip to the Messages API. Validates that the key
 * works, the model is reachable, and the network path is open. Caps output
 * at 1 token so cost stays trivial.
 */
export async function pingAnthropic(model?: string): Promise<PingResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const keyConfigured = Boolean(apiKey);
  const useModel = model ?? DEFAULT_MODEL;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  const t0 = Date.now();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: useModel,
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  const latencyMs = Date.now() - t0;
  if (!res.ok) {
    const detail = await res.text().catch(() => `${res.status}`);
    throw new Error(`Anthropic ${res.status}: ${detail}`);
  }
  return { latencyMs, model: useModel, keyConfigured };
}

/**
 * Pull the first JSON object/array out of a model response. Models often
 * wrap JSON in prose or fenced code blocks even when instructed not to.
 */
export function extractJson<T>(text: string): T | null {
  if (!text) return null;
  // Try fenced ```json ... ``` first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : null;
  for (const src of [candidate, text]) {
    if (!src) continue;
    const start = src.indexOf("{");
    const arrStart = src.indexOf("[");
    const first =
      start === -1
        ? arrStart
        : arrStart === -1
        ? start
        : Math.min(start, arrStart);
    if (first === -1) continue;
    // Walk to the matching closing brace, respecting strings.
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    const open = src[first];
    const close = open === "{" ? "}" : "]";
    for (let i = first; i < src.length; i++) {
      const ch = src[i];
      if (inStr) {
        if (esc) {
          esc = false;
        } else if (ch === "\\") {
          esc = true;
        } else if (ch === '"') {
          inStr = false;
        }
        continue;
      }
      if (ch === '"') {
        inStr = true;
      } else if (ch === open) {
        depth += 1;
      } else if (ch === close) {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    // Build the candidate slice. If we never found a matching close
    // brace, the response was almost certainly truncated by max_tokens —
    // close any open string + any open braces and let the lenient parser
    // try to salvage what came through.
    let slice: string;
    if (end === -1) {
      slice = src.slice(first);
      if (inStr) slice += '"';
      for (let d = 0; d < depth; d++) slice += close;
    } else {
      slice = src.slice(first, end + 1);
    }

    // Try strict parse first; fall back to a sanitized version that
    // escapes literal control characters inside string values, which
    // Claude sometimes emits in body_markdown even though it's invalid
    // JSON.
    const parsed =
      tryParseJson<T>(slice) ?? tryParseJson<T>(sanitizeJsonControlChars(slice));
    if (parsed !== null) return parsed;
  }
  return null;
}

function tryParseJson<T>(src: string): T | null {
  try {
    return JSON.parse(src) as T;
  } catch {
    return null;
  }
}

/**
 * Walk a JSON string and replace literal control characters that appear
 * INSIDE string values with their escape sequences. Anything outside a
 * string is left as-is so the structure stays intact.
 */
function sanitizeJsonControlChars(src: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) {
        out += ch;
        esc = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        esc = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inStr = false;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        out += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') inStr = true;
    out += ch;
  }
  return out;
}
