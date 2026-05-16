import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getPrismaUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { loadDocumentBlocks, DocBlock } from "@/lib/docLoader";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { sanitizeHtml, extractJsonFromText, validateGradingResult } from "@/lib/checkAnswerHelpers";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getPrismaUser();
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    courseId?: string;
    question?: string;
    correctAnswer?: string | null;
    userAnswer?: string;
    outcomeName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { question, correctAnswer, userAnswer, outcomeName, courseId } = body;
  const safeQuestion = sanitizeHtml(question ?? "");
  const safeAnswer = sanitizeHtml(userAnswer ?? "");
  const safeOutcome = sanitizeHtml(outcomeName ?? "");

  if (!question || !userAnswer) {
    return NextResponse.json({ error: "Missing question or answer" }, { status: 400 });
  }

  try {
    const allowed = await checkRateLimit(user.id, "ai");
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests — please wait a moment before trying again." },
        { status: 429 }
      );
    }
  } catch {
    // Redis unavailable — fail open rather than blocking the user
  }

  if (courseId) {
    let owns;
    try {
      owns = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
    } catch {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let docBlocks: DocBlock[] = [];
  try {
    if (courseId) {
      docBlocks = await loadDocumentBlocks(courseId, ["lecture", "outcomes"], 2);
    }
  } catch {
    // Degrade gracefully — grade without course materials
  }

  const prompt = `You are a fair and encouraging university study coach grading a student's answer.
${
  docBlocks.length > 0
    ? "Course materials are provided above. Grade based ONLY on what is taught in these specific materials — reference the actual content, examples, and terminology from the notes."
    : "No course materials available — grade based on general correctness."
}

<question>${safeQuestion}</question>
<learning_outcome>${safeOutcome || "Not specified"}</learning_outcome>
<student_answer>${safeAnswer}</student_answer>

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

    const parsed = extractJsonFromText(text);
    if (!parsed) throw new Error("No JSON object found in response");

    const result = validateGradingResult(parsed.result);

    return NextResponse.json({
      result,
      explanation: String(parsed.explanation),
      suggestedMark: Boolean(parsed.suggestedMark),
    });
  } catch {
    return NextResponse.json(
      {
        result: "incorrect",
        explanation: "Could not check answer — please mark manually.",
        suggestedMark: false,
      },
      { status: 500 }
    );
  }
}
