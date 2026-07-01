import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { loadDocumentBlocks, DocBlock } from "@/lib/docLoader";
import { anthropic } from "@/lib/anthropic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  console.error("GEN 1: route hit, courseId:", courseId);

  const user = await getPrismaUser();
  console.error("GEN 2: user:", user?.id);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await checkRateLimit(user.id, "ai");
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment before trying again." },
      { status: 429 }
    );
  }

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const topicIds: string[] = (body.topicIds ?? []).filter(Boolean);
  const outcomeIds: string[] = (body.outcomeIds ?? []).filter(Boolean);
  const count: number = Math.min(Math.max(1, Number(body.count) || 10), 40);

  // Fetch outcomes: use explicit outcomeIds > topicIds > all course outcomes as fallback
  const outcomes = await (
    outcomeIds.length > 0
      ? prisma.learningOutcome.findMany({ where: { id: { in: outcomeIds }, courseId }, include: { topic: true } })
      : topicIds.length > 0
      ? prisma.learningOutcome.findMany({ where: { topicId: { in: topicIds }, courseId }, include: { topic: true } })
      : prisma.learningOutcome.findMany({ where: { courseId }, include: { topic: true } })
  );

  console.error("GEN 3: outcomes count:", outcomes.length, "topicIds:", topicIds, "outcomeIds:", outcomeIds);

  if (outcomes.length === 0) {
    return NextResponse.json(
      { error: "No outcomes found for this course. Add learning outcomes before generating questions." },
      { status: 400 }
    );
  }

  type ContentBlock = { type: "text"; text: string } | DocBlock;

  const docBlocks = await loadDocumentBlocks(courseId, ["lecture", "outcomes"], 2);
  console.error("GEN 4: docBlocks count:", docBlocks.length);
  const hasNotesDocs = docBlocks.length > 0;

  const outcomeList = outcomes
    .map((o) => `- id: "${o.id}" | topicId: "${o.topic.id}" | topic: "${o.topic.name}" | outcome: "${o.name}"`)
    .join("\n");

  const prompt = `You are generating practice questions for a university course.

${docBlocks.length > 0 ? "Course documents are attached above. Generate questions ONLY from content explicitly present in these documents — do not invent questions from general knowledge. If a topic from the outcomes list is not covered in the documents, skip it." : "No course documents are available — generate questions based solely on the outcomes listed below."}

Generate exactly ${count} questions total, distributed evenly across the provided outcomes. Mix question types naturally:
- WRITTEN for conceptual/explain/discuss questions
- MULTIPLE_CHOICE for recognition, application, and fact-based questions
- FILL_IN_BLANK for definitions and fill-the-gap questions

You MUST use these exact ids in your response — do not make up new ones:
${outcomeList}

CRITICAL RULES:
1. Use ONLY the exact ids listed above for outcomeIds and topicIds — copy them character-for-character.
2. Each question must include the outcomeIds and topicIds arrays it relates to.
3. For MULTIPLE_CHOICE: provide exactly 4 options, exactly 1 must be correct (isCorrect: true), set answer to "Correct: A" (or B/C/D matching index).
4. For FILL_IN_BLANK: use exactly three underscores ___ for each blank in content, provide blanks array with correct answers in order, set answer to the full sentence with blanks filled in square brackets like [answer].
5. For WRITTEN: provide a concise model answer.

Return ONLY a valid JSON object — no markdown fences, no explanation, no text before or after:
{
  "questions": [
    {
      "type": "WRITTEN",
      "content": "Question text",
      "answer": "Model answer",
      "outcomeIds": ["<exact id from list above>"],
      "topicIds": ["<exact topicId from list above>"]
    },
    {
      "type": "MULTIPLE_CHOICE",
      "content": "Question text",
      "answer": "Correct: A",
      "options": [
        { "id": "a", "text": "Correct option", "isCorrect": true },
        { "id": "b", "text": "Wrong option", "isCorrect": false },
        { "id": "c", "text": "Wrong option", "isCorrect": false },
        { "id": "d", "text": "Wrong option", "isCorrect": false }
      ],
      "outcomeIds": ["<exact id from list above>"],
      "topicIds": ["<exact topicId from list above>"]
    },
    {
      "type": "FILL_IN_BLANK",
      "content": "The ___ is responsible for ___",
      "answer": "The [answer1] is responsible for [answer2]",
      "blanks": ["answer1", "answer2"],
      "outcomeIds": ["<exact id from list above>"],
      "topicIds": ["<exact topicId from list above>"]
    }
  ]
}`;

  try {
    const contentBlocks: ContentBlock[] = [...docBlocks, { type: "text", text: prompt }];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    let parsed: { questions?: unknown[] };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("JSON parse failed:", parseErr, "\nRaw text:", text);
      return NextResponse.json({ error: "Claude returned invalid JSON", raw: text.slice(0, 1000) }, { status: 500 });
    }

    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

    if (questions.length === 0) {
      console.error("Claude returned 0 questions. Full response:", text);
      return NextResponse.json(
        { error: "AI generated no questions — try again or check your learning outcomes." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      questions,
      ...(hasNotesDocs ? {} : { warning: "no_notes" }),
    });
  } catch (err) {
    console.error("GEN 5: Claude error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
