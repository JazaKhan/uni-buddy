import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";
import { weightedScore } from "@/lib/mastery";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: {
      questionAttempts: {
        include: {
          question: {
            include: {
              questionOutcomes: {
                include: { learningOutcome: true },
              },
              questionTopics: { select: { topicId: true } },
            },
          },
        },
      },
    },
  });

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Batch 1: pre-fetch ALL topic→outcome mappings in one query before the loop
  const allTopicIds = session.questionAttempts.flatMap((a) =>
    a.question.questionTopics.map((qt) => qt.topicId)
  );
  const topicOutcomeMap: Record<string, string[]> = {};
  if (allTopicIds.length > 0) {
    const topicOutcomes = await prisma.learningOutcome.findMany({
      where: { topicId: { in: allTopicIds } },
      select: { id: true, topicId: true },
    });
    for (const o of topicOutcomes) {
      if (!topicOutcomeMap[o.topicId]) topicOutcomeMap[o.topicId] = [];
      topicOutcomeMap[o.topicId].push(o.id);
    }
  }

  // Group attempt scores by outcome — no DB calls inside this loop
  const outcomeAttempts: Record<string, number[]> = {};
  for (const attempt of session.questionAttempts) {
    let outcomeIds = attempt.question.questionOutcomes.map((qo) => qo.learningOutcomeId);

    if (outcomeIds.length === 0) {
      outcomeIds = attempt.question.questionTopics.flatMap((qt) =>
        topicOutcomeMap[qt.topicId] ?? []
      );
    }

    const score = weightedScore(attempt.isCorrect, attempt.confidence);
    for (const outcomeId of outcomeIds) {
      if (!outcomeAttempts[outcomeId]) outcomeAttempts[outcomeId] = [];
      outcomeAttempts[outcomeId].push(score);
    }
  }

  // Batch 2: fetch ALL existing mastery scores in one query before updating
  const touchedOutcomeIds = Object.keys(outcomeAttempts);
  const existingScores = await prisma.masteryScore.findMany({
    where: { userId: user.id, learningOutcomeId: { in: touchedOutcomeIds } },
  });
  const existingMap = new Map(existingScores.map((s) => [s.learningOutcomeId, s.score]));

  // Decaying average: new session counts 60%, history counts 40% — no findUnique inside the loop
  await Promise.all(
    Object.entries(outcomeAttempts).map(async ([learningOutcomeId, scores]) => {
      const sessionAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const existing = existingMap.get(learningOutcomeId);

      const newScore = existing !== undefined
        ? Math.round(((existing / 100) * 0.4 + sessionAvg * 0.6) * 100)
        : Math.round(sessionAvg * 100);

      await prisma.masteryScore.upsert({
        where: { userId_learningOutcomeId: { userId: user.id, learningOutcomeId } },
        update: { score: newScore },
        create: { userId: user.id, learningOutcomeId, score: newScore },
      });
    })
  );

  const attempts = session.questionAttempts;
  const total = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;

  const confidenceBreakdown = {
    CONFIDENT: attempts.filter((a) => a.confidence === "CONFIDENT").length,
    UNSURE: attempts.filter((a) => a.confidence === "UNSURE").length,
    GUESSED: attempts.filter((a) => a.confidence === "GUESSED").length,
  };

  // Collect all outcomes touched in this session
  const outcomeMap = new Map<string, { id: string; name: string }>();
  for (const attempt of attempts) {
    for (const qo of attempt.question.questionOutcomes) {
      outcomeMap.set(qo.learningOutcomeId, {
        id: qo.learningOutcomeId,
        name: qo.learningOutcome.name,
      });
    }
  }

  // Fetch fresh mastery scores (just written above)
  const outcomeIds = Array.from(outcomeMap.keys());
  const masteryScores = await prisma.masteryScore.findMany({
    where: { userId: user.id, learningOutcomeId: { in: outcomeIds } },
  });
  const masteryMap = new Map(masteryScores.map((m) => [m.learningOutcomeId, m.score]));

  const rankedOutcomes = Array.from(outcomeMap.values())
    .map((o) => ({ id: o.id, name: o.name, score: masteryMap.get(o.id) ?? 0 }))
    .sort((a, b) => a.score - b.score);

  return NextResponse.json({ total, correct, confidenceBreakdown, rankedOutcomes });
}
