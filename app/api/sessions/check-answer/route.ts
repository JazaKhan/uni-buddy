import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getPrismaUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { loadDocumentBlocks } from "@/lib/docLoader";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkRateLimit(user.id, "ai");
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment before trying again." },
      { status: 429 }
    );
  }
  let body: { courseId?: string; question?: string; correctAnswer?: string | null; userAnswer?: string; outcomeName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ result: "incorrect", explanation: "Invalid request.", suggestedMark: false });
  }

  const { question, correctAnswer, userAnswer, outcomeName, courseId } = body;

  const docBlocks = courseId
    ? await loadDocumentBlocks(courseId, ["lecture", "outcomes"], 2)
    : [];

  if (!question || !userAnswer) {
    return NextResponse.json({ result: "incorrect", explanation: "Missing question or answer.", suggestedMark: false });
  }

  const prompt = `You are a fair and encouraging university study coach grading a student's answer.
${docBlocks.length > 0
    ? "Course materials are provided above. Grade based ONLY on what is taught in these specific materials — reference the actual content, examples, and terminology from the notes."
    : "No course materials available — grade based on general correctness."}

Question: ${question}
Learning outcome: ${outcomeName || "Not specified"}
${correctAnswer ? `Model answer: ${correctAnswer}` : "No model answer — grade on whether the answer is reasonable."}
Student's answer: ${userAnswer}

Grading rules:
- If the student's answer conveys the same meaning as the model answer, even in different words → "correct"
- If the student closely paraphrased or captured the core idea → "correct"
- Only mark "partial" if missing a significant concept from the model answer
- Only mark "incorrect" if fundamentally wrong or contradicting the model answer
- Do NOT penalize for informal phrasing or missing extra detail
- If course materials are provided, reference specific content from them in your explanation

Return ONLY valid JSON:
{
  "result": "correct" | "partial" | "incorrect",
  "explanation": "1-2 sentences — affirm what they got right, or explain the gap referencing the course materials where possible.",
  "suggestedMark": true | false
}
suggestedMark: true for correct or partial, false for incorrect only.`;

  const contentBlocks: Anthropic.MessageParam["content"] = [
    ...docBlocks,
    { type: "text" as const, text: prompt },
  ];

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");
    const parsed = JSON.parse(jsonMatch[0]);

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
