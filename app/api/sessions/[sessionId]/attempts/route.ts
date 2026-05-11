import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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

function weightedScore(isCorrect: boolean, confidence: string): number {
  if (isCorrect) {
    if (confidence === "CONFIDENT") return 1.0;
    if (confidence === "UNSURE") return 0.7;
    return 0.5; // GUESSED
  } else {
    if (confidence === "CONFIDENT") return 0.0;
    if (confidence === "UNSURE") return 0.2;
    return 0.1; // GUESSED
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { questionId, isCorrect, confidence } = await req.json();
  if (!questionId || isCorrect === undefined || !confidence)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Map lowercase confidence from frontend to enum
  const confidenceEnum = (confidence as string).toUpperCase() as "GUESSED" | "UNSURE" | "CONFIDENT";

  // Verify session belongs to user
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Log attempt
  await prisma.questionAttempt.create({
    data: { sessionId, questionId, isCorrect, confidence: confidenceEnum },
  });

  // Get outcomes directly tagged to this question
  let outcomeIds = (await prisma.questionOutcome.findMany({
    where: { questionId },
    select: { learningOutcomeId: true },
  })).map((qo) => qo.learningOutcomeId);

  // Fallback: if no outcomes tagged, use all outcomes for the question's topics
  if (outcomeIds.length === 0) {
    const questionTopics = await prisma.questionTopic.findMany({
      where: { questionId },
      select: { topicId: true },
    });
    const topicIds = questionTopics.map((qt) => qt.topicId);
    if (topicIds.length > 0) {
      const outcomes = await prisma.learningOutcome.findMany({
        where: { topicId: { in: topicIds } },
        select: { id: true },
      });
      outcomeIds = outcomes.map((o) => o.id);
    }
  }

  // Recalculate and upsert MasteryScore for each outcome
  for (const learningOutcomeId of outcomeIds) {
    const allAttempts = await prisma.questionAttempt.findMany({
      where: {
        session: { userId: user.id },
        question: {
          OR: [
            { questionOutcomes: { some: { learningOutcomeId } } },
            {
              questionOutcomes: { none: {} },
              questionTopics: {
                some: {
                  topic: { learningOutcomes: { some: { id: learningOutcomeId } } },
                },
              },
            },
          ],
        },
      },
    });

    const score =
      allAttempts.length === 0
        ? 0
        : Math.round(
            (allAttempts.reduce((sum, a) => sum + weightedScore(a.isCorrect, a.confidence), 0) /
              allAttempts.length) * 100
          );

    await prisma.masteryScore.upsert({
      where: { userId_learningOutcomeId: { userId: user.id, learningOutcomeId } },
      update: { score },
      create: { userId: user.id, learningOutcomeId, score },
    });
  }

  return NextResponse.json({ success: true });
}
