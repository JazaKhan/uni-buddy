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
            },
          },
        },
      },
    },
  });

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  // Get mastery scores for these outcomes
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
