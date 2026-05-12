import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

function weightedScore(isCorrect: boolean, confidence: string): number {
  if (isCorrect) {
    if (confidence === "CONFIDENT") return 1.0;
    if (confidence === "UNSURE") return 0.7;
    return 0.5;
  } else {
    if (confidence === "CONFIDENT") return 0.0;
    if (confidence === "UNSURE") return 0.2;
    return 0.1;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.upsert({
    where: { email: authUser.email },
    update: {},
    create: { email: authUser.email },
  });

  // Verify course belongs to user
  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // All outcomes for this course (so we can average mastery across all of them)
  const outcomes = await prisma.learningOutcome.findMany({
    where: { courseId },
    select: { id: true },
  });
  const allOutcomeIds = outcomes.map((o) => o.id);

  // All sessions for this course, chronological, with their attempts
  const sessions = await prisma.studySession.findMany({
    where: { courseId, userId: user.id },
    orderBy: { startedAt: "asc" },
    include: {
      questionAttempts: {
        include: {
          question: {
            include: {
              questionOutcomes: { select: { learningOutcomeId: true } },
              questionTopics: {
                include: {
                  topic: { include: { learningOutcomes: { select: { id: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (sessions.length === 0) return NextResponse.json({ history: [] });

  // Walk sessions in order, accumulate attempts, compute mastery snapshot after each
  const accumulated: Array<{ isCorrect: boolean; confidence: string; outcomeIds: string[] }> = [];

  const history = sessions.map((session, i) => {
    for (const attempt of session.questionAttempts) {
      let oIds = attempt.question.questionOutcomes.map((qo) => qo.learningOutcomeId);
      if (oIds.length === 0) {
        oIds = attempt.question.questionTopics.flatMap((qt) =>
          qt.topic.learningOutcomes.map((lo) => lo.id)
        );
      }
      accumulated.push({ isCorrect: attempt.isCorrect, confidence: attempt.confidence, outcomeIds: oIds });
    }

    // Compute per-outcome running mastery
    const scoreMap: Record<string, { sum: number; count: number }> = {};
    for (const a of accumulated) {
      const s = weightedScore(a.isCorrect, a.confidence);
      for (const oid of a.outcomeIds) {
        if (!scoreMap[oid]) scoreMap[oid] = { sum: 0, count: 0 };
        scoreMap[oid].sum += s;
        scoreMap[oid].count += 1;
      }
    }

    const scored = allOutcomeIds
      .filter((id) => scoreMap[id])
      .map((id) => Math.round((scoreMap[id].sum / scoreMap[id].count) * 100));

    const mastery =
      scored.length > 0
        ? Math.round(scored.reduce((s, v) => s + v, 0) / scored.length)
        : 0;

    return {
      sessionNumber: i + 1,
      date: session.startedAt.toISOString().split("T")[0],
      mastery,
    };
  });

  return NextResponse.json({ history });
}