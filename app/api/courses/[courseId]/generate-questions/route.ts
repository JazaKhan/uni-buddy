import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

async function getPrismaUser() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return null;
  return prisma.user.upsert({
    where: { email: authUser.email },
    update: {},
    create: { email: authUser.email },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const topicIds: string[] = (body.topicIds ?? []).filter(Boolean);
  const outcomeIds: string[] = (body.outcomeIds ?? []).filter(Boolean);
  const count: number = body.count ?? 10;

  console.log("1. generate-questions hit, body:", { topicIds, outcomeIds, count });

  // Fetch outcomes: use explicit outcomeIds > topicIds > all course outcomes as fallback
  const outcomes = await (
    outcomeIds.length > 0
      ? prisma.learningOutcome.findMany({ where: { id: { in: outcomeIds }, courseId }, include: { topic: true } })
      : topicIds.length > 0
      ? prisma.learningOutcome.findMany({ where: { topicId: { in: topicIds }, courseId }, include: { topic: true } })
      : prisma.learningOutcome.findMany({ where: { courseId }, include: { topic: true } })
  );

  console.log("2. Outcomes fetched:", outcomes.length);

  if (outcomes.length === 0) {
    console.log("2a. No outcomes found — returning 500");
    return NextResponse.json({ error: "No outcomes found for this course. Add learning outcomes before generating questions." }, { status: 500 });
  }

  // Fetch up to 3 lecture/outcomes documents for context
  const documents = await prisma.document.findMany({
    where: { courseId, purpose: { in: ["lecture", "outcomes"] } },
    take: 3,
    orderBy: { createdAt: "desc" },
  });
  const hasNotesDocs = documents.length > 0;

  console.log("3. Documents fetched:", documents.length);

  // Build document content blocks for Claude — fetch all in parallel, skip >20MB
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

  const TWENTY_MB = 20 * 1024 * 1024;
  const docBlocks: ContentBlock[] = (
    await Promise.all(
      documents.map(async (doc) => {
        try {
          const res = await fetch(doc.fileUrl);
          if (!res.ok) { console.log("3a. Failed to fetch doc:", doc.name, res.status); return null; }
          const buf = await res.arrayBuffer();
          if (buf.byteLength > TWENTY_MB) { console.log("3a. Skipping doc >20MB:", doc.name); return null; }
          return {
            type: "document" as const,
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: Buffer.from(buf).toString("base64") },
          };
        } catch (err) {
          console.log("3b. Error fetching doc:", doc.name, String(err));
          return null;
        }
      })
    )
  ).filter((b): b is ContentBlock & { type: "document" } => b !== null);

  // Build outcome list with real DB ids explicitly injected into the prompt
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

  console.log("4. Calling Claude with", outcomes.length, "outcomes and", docBlocks.length, "doc blocks");

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const contentBlocks: ContentBlock[] = [...docBlocks, { type: "text", text: prompt }];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    console.log("5. Claude raw response (first 500):", text.slice(0, 500));

    const clean = text.replace(/```json[\s\S]*?```|```[\s\S]*?```/g, (m) => {
      // extract content inside fences if any
      const inner = m.replace(/^```json\n?|^```\n?|```$/gm, "");
      return inner;
    }).trim();

    let parsed: { questions?: unknown[] };
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error("5a. JSON parse failed:", parseErr, "\nRaw text:", text);
      return NextResponse.json({ error: "Claude returned invalid JSON", raw: text.slice(0, 1000) }, { status: 500 });
    }

    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    console.log("6. Parsed questions:", questions.length);

    if (questions.length === 0) {
      console.error("6a. Claude returned 0 questions. Full response:", text);
      return NextResponse.json({ error: "AI generated no questions — try again or check your learning outcomes." }, { status: 500 });
    }

    return NextResponse.json({
      questions,
      ...(hasNotesDocs ? {} : { warning: "no_notes" }),
    });
  } catch (err) {
    console.error("AI question generation error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
