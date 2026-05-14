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

  const prompt = `You are a fair and encouraging university study coach grading a student's answer.

Question: ${question}
Learning outcome: ${outcomeName || "Not specified"}
${correctAnswer ? `Model answer: ${correctAnswer}` : "No model answer — use your knowledge."}
Student's answer: ${userAnswer}

Grading rules:
- If the student's answer conveys the same meaning as the model answer, even in different words → "correct"
- If the student closely paraphrased or captured the core idea → "correct"
- Only mark "partial" if they got the core idea but are clearly missing a significant concept
- Only mark "incorrect" if they fundamentally misunderstood or gave a wrong answer
- Do NOT penalize for missing extra detail unless the question specifically asks for it
- Do NOT mark down for informal phrasing or incomplete sentences

Return ONLY valid JSON:
{
  "result": "correct" | "partial" | "incorrect",
  "explanation": "1-2 sentences. If correct, affirm what they got right. If partial/incorrect, explain the gap concisely.",
  "suggestedMark": true | false
}

suggestedMark: true for correct or partial, false for incorrect only.`;

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
