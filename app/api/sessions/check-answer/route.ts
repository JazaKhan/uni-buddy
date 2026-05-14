import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  let body: { question?: string; correctAnswer?: string | null; userAnswer?: string; outcomeName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ result: "incorrect", explanation: "Invalid request.", suggestedMark: false });
  }

  const { question, correctAnswer, userAnswer, outcomeName } = body;

  if (!question || !userAnswer) {
    return NextResponse.json({ result: "incorrect", explanation: "Missing question or answer.", suggestedMark: false });
  }

  const prompt = `You are grading a university student's answer to an exam question.

Question: ${question}
Learning outcome being tested: ${outcomeName || "Not specified"}
${correctAnswer ? `Model answer: ${correctAnswer}` : "No model answer provided — use your knowledge to assess correctness."}
Student's answer: ${userAnswer}

Assess the student's answer. Be fair but rigorous — partial credit for answers that show understanding but miss key details.

Return ONLY valid JSON:
{
  "result": "correct" | "partial" | "incorrect",
  "explanation": "2-3 sentence explanation of what was right/wrong and what the key concept is",
  "suggestedMark": true or false
}

suggestedMark should be true for "correct" and "partial", false for "incorrect".`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      result: parsed.result as "correct" | "partial" | "incorrect",
      explanation: String(parsed.explanation),
      suggestedMark: Boolean(parsed.suggestedMark),
    });
  } catch {
    return NextResponse.json({
      result: "incorrect",
      explanation: "Could not check answer — please mark manually.",
      suggestedMark: false,
    });
  }
}
