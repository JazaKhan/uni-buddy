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

  const [masteryScores, topics, documents] = await Promise.all([
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
      take: 2,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  console.log("RECS 4: masteryScores:", masteryScores.length, "topics:", topics.length, "docs:", documents.length);

  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

  const docBlocks: ContentBlock[] = [];
  for (const doc of documents) {
    try {
      const res = await fetch(doc.fileUrl);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      docBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: Buffer.from(buf).toString("base64") },
      });
    } catch {
      // skip failed docs
    }
  }

  const attemptLines = session.questionAttempts
    .map((a) => `- "${a.question.content.slice(0, 80)}..." → ${a.isCorrect ? "Correct" : "Incorrect"} (${a.confidence.toLowerCase()})`)
    .join("\n");

  const outcomeLines = masteryScores.length > 0
    ? masteryScores
        .map((ms) => `- ${ms.learningOutcome.name} (${ms.learningOutcome.topic?.name ?? "Unknown"}): ${Math.round(ms.score * 100)}%`)
        .join("\n")
    : "No outcome mastery data available yet.";

  const topicsStr = topics.map((t) => `{ id: "${t.id}", name: "${t.name}" }`).join(", ");

  const prompt = `You are a university study coach reviewing a student's practice session results.

${docBlocks.length > 0 ? "Course materials are provided above — reference specific content where relevant." : ""}

Session performance:
${attemptLines || "No attempts recorded."}

Outcome mastery after this session:
${outcomeLines}

Give the student 3-4 sentences of specific, actionable study advice. Be direct — tell them exactly what to focus on, what to skip, and how to study the weak areas. Reference specific outcomes by name. Do not be generic.

Then suggest the single best next session focus (one topic name only).

Return ONLY valid JSON:
{
  "advice": "3-4 sentence paragraph of specific advice",
  "nextTopic": "Topic name to focus on next",
  "nextTopicId": "the topic id from the list below"
}

Available topics: ${topicsStr}`;

  console.log("RECS 5: calling Claude...");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const contentBlocks: ContentBlock[] = [...docBlocks, { type: "text", text: prompt }];

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
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
