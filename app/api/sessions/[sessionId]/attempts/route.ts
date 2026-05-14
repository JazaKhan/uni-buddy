import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";

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

  // Incremental mastery: rolling weighted average using this attempt only
  const newAttemptScore = weightedScore(isCorrect, confidenceEnum);
  for (const learningOutcomeId of outcomeIds) {
    const existing = await prisma.masteryScore.findUnique({
      where: { userId_learningOutcomeId: { userId: user.id, learningOutcomeId } },
    });
    const currentScore = existing ? existing.score / 100 : 0;
    const newScore = Math.round((currentScore * 0.7 + newAttemptScore * 0.3) * 100);
    await prisma.masteryScore.upsert({
      where: { userId_learningOutcomeId: { userId: user.id, learningOutcomeId } },
      update: { score: newScore },
      create: { userId: user.id, learningOutcomeId, score: newScore },
    });
  }

  return NextResponse.json({ success: true });
}
