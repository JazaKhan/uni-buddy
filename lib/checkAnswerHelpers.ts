export const VALID_RESULTS = ["correct", "partial", "incorrect"] as const;
export type GradingResult = (typeof VALID_RESULTS)[number];

export function sanitizeHtml(input: string): string {
  return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function extractJsonFromText(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function validateGradingResult(result: unknown): GradingResult {
  return (VALID_RESULTS as readonly string[]).includes(result as string)
    ? (result as GradingResult)
    : "incorrect";
}
