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
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
  const { sessionId } = await params;
  console.log("RECS 1: route hit, sessionId:", sessionId);

  const user = await getPrismaUser();
  console.log("RECS 2: user found:", user?.id);
  if (!user) return NextResponse.json({ advice: null });

  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: {
      questionAttempts: {
        include: {
          question: {
            include: {
              questionOutcomes: {
                include: {
                  learningOutcome: {
                    include: { topic: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  console.log("RECS 3: session found:", !!session, "attempts:", session?.questionAttempts?.length);
  if (!session) return NextResponse.json({ advice: null });
  const courseId = session.courseId;

  const touchedOutcomeIds = new Set<string>();
  for (const attempt of session.questionAttempts) {
    for (const qo of attempt.question.questionOutcomes) {
      touchedOutcomeIds.add(qo.learningOutcomeId);
    }
  }

  const [masteryScores, topics, docs] = await Promise.all([
    prisma.masteryScore.findMany({
      where: { learningOutcomeId: { in: [...touchedOutcomeIds] }, userId: user.id },
      include: { learningOutcome: { include: { topic: true } } },
    }),
    prisma.topic.findMany({
      where: { courseId },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    }),
    prisma.document.findMany({
      where: { courseId, purpose: { in: ["lecture", "outcomes"] } },
      take: 3,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  console.log("RECS 4: masteryScores:", masteryScores.length, "topics:", topics.length, "docs:", docs.length);

  // Load PDFs in parallel — skip any that fail or exceed 20MB
  const TWENTY_MB = 20 * 1024 * 1024;
  const docContents: { data: string; name: string }[] = (
    await Promise.all(
      docs.map(async (doc) => {
        try {
          const res = await fetch(doc.fileUrl);
          if (!res.ok) return null;
          const buf = await res.arrayBuffer();
          if (buf.byteLength > TWENTY_MB) return null;
          return { data: Buffer.from(buf).toString("base64"), name: doc.name };
        } catch {
          return null;
        }
      })
    )
  ).filter((d): d is { data: string; name: string } => d !== null);

  const total = session.questionAttempts.length;
  const correct = session.questionAttempts.filter((a) => a.isCorrect).length;

  const attemptLines = session.questionAttempts
    .map((a) => {
      const outcomeNames = a.question.questionOutcomes
        .map((qo) => qo.learningOutcome.name)
        .join(", ");
      return `- "${a.question.content.slice(0, 100)}..." → ${a.isCorrect ? "✓ Correct" : "✗ Incorrect"} | Confidence: ${a.confidence}${outcomeNames ? ` | Tests: ${outcomeNames}` : ""}`;
    })
    .join("\n");

  const outcomeStats = masteryScores.map((ms) => ({
    name: ms.learningOutcome.name,
    topic: ms.learningOutcome.topic?.name ?? "Unknown",
    score: Math.min(ms.score, 1),
  }));

  const outcomeLines = outcomeStats.length > 0
    ? outcomeStats.map((o) => `- ${o.name} (${o.topic}): ${Math.round(o.score * 100)}%`).join("\n")
    : "No outcome mastery data available yet.";

  const topicsStr = topics.map((t) => `{ "id": "${t.id}", "name": "${t.name}" }`).join(", ");

  const promptText = `You are a university study coach reviewing a student's practice session.
${docContents.length > 0
    ? "The student's course notes are provided above. Base your advice ONLY on content explicitly present in these documents — do not draw on general university or textbook knowledge not present in the files. Reference specific concepts, examples, and terminology from the notes."
    : "No course notes are uploaded for this course. Base advice only on the session performance data and outcome names provided below — do not introduce outside knowledge."}

Session performance (${correct}/${total} correct):
${attemptLines || "No attempts recorded."}

Outcome mastery after this session:
${outcomeLines}

Give 3-4 sentences of specific, actionable advice:
- Reference specific concepts from the course notes where possible
- Call out patterns in what the student got wrong (not just "study more")
- Tell them exactly HOW to study the weak areas
- Skip anything they clearly already know
- Keep mastery scores as 0-100%, never higher

Then name the single best topic to focus on next.

Return ONLY valid JSON, no other text:
{
  "advice": "3-4 sentence paragraph of specific, grounded advice",
  "nextTopic": "Topic name",
  "nextTopicId": "exact topic id from the list below"
}

Available topics: ${topicsStr}`;

  console.log("RECS 5: calling Claude...");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const contentBlocks: Anthropic.MessageParam["content"] = [
    ...docContents.map((d) => ({
      type: "document" as const,
      source: {
        type: "base64" as const,
        media_type: "application/pdf" as const,
        data: d.data,
      },
      title: d.name,
    })),
    { type: "text" as const, text: promptText },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: contentBlocks }],
  });

  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  console.log("RECS 6: Claude raw response:", text?.slice(0, 300));

  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  console.log("RECS 7: parsed:", JSON.stringify(parsed).slice(0, 200));

  return NextResponse.json({
    advice: String(parsed.advice),
    nextTopic: String(parsed.nextTopic),
    nextTopicId: String(parsed.nextTopicId),
  });

  } catch (err) {
    console.error("Recommendations error:", err);
    return NextResponse.json({ advice: null });
  }
}
