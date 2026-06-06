import type { AICommandCard } from "@/types/global";
import type { ParsedStructuredOutput } from "./types";

export function looksLikeStructuredJsonOutput(content: string) {
  const trimmed = content.trimStart();
  if (trimmed.includes('"text"') && trimmed.includes('"commandCards"')) return true;
  const jsonBody = trimmed.startsWith("```json")
    ? trimmed.slice(trimmed.indexOf("\n") + 1).trimStart()
    : trimmed;
  return jsonBody.startsWith("{") && !jsonBody.startsWith("{{");
}

export function extractThinkContent(content: string): {
  visible: string;
  reasoning: string | null;
} {
  const closedRegex = /<think>([\s\S]*?)<\/think>/gi;
  const reasoningParts: string[] = [];

  for (const match of content.matchAll(closedRegex)) {
    const part = match[1]?.trim();
    if (part) reasoningParts.push(part);
  }

  let visible = content.replace(closedRegex, "");

  const openIdx = visible.lastIndexOf("<think>");
  if (openIdx >= 0) {
    const trailing = visible.slice(openIdx + 7).trim();
    if (trailing) reasoningParts.push(trailing);
    visible = visible.slice(0, openIdx);
  }

  visible = visible.replace(/<(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?$/, "");

  return {
    visible: visible.trim(),
    reasoning: reasoningParts.length > 0 ? reasoningParts.join("\n\n") : null,
  };
}

export function tryParseStructuredOutput(content: string): ParsedStructuredOutput | null {
  const stripped = content
    .trim()
    .replace(/^```json\s*\n?/, "")
    .replace(/^```\s*\n?/, "")
    .replace(/```\s*$/, "")
    .trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(stripped.slice(start, end + 1));
    if (obj && typeof obj.text === "string" && obj.text.trim()) {
      return {
        text: obj.text,
        commandCards: Array.isArray(obj.commandCards) ? (obj.commandCards as AICommandCard[]) : [],
      };
    }
  } catch {
    /* incomplete JSON */
  }
  return null;
}
