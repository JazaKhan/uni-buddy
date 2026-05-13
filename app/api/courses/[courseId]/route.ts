import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function getPrismaUser(supabase: Awaited<ReturnType<typeof createClient>>) {
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
  const user = await getPrismaUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findFirst({
    where: { id: courseId, userId: user.id },
    include: {
      topics: {
        include: {
          _count: { select: { questionTopics: true } },
          learningOutcomes: {
            include: {
              masteryScores: { where: { userId: user.id } },
            },
          },
        },
      },
    },
  });

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const topics = course.topics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    questionCount: topic._count.questionTopics,
    outcomes: topic.learningOutcomes.map((lo) => ({
      id: lo.id,
      name: lo.name,
      description: lo.description,
      mastery: lo.masteryScores[0]?.score ?? 0,
    })),
  }));

  const allOutcomes = topics.flatMap((t) => t.outcomes);
  const allOutcomeIds = allOutcomes.map((o) => o.id);

  const courseMastery =
    allOutcomes.length > 0
      ? Math.round(allOutcomes.reduce((sum, o) => sum + o.mastery, 0) / allOutcomes.length)
      : 0;

  // --- Mastery history: one data point per session ---
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

  const accumulated: Array<{ isCorrect: boolean; confidence: string; outcomeIds: string[] }> = [];

  const masteryHistory = sessions
    .filter((s) => s.questionAttempts.length > 0)
    .map((session, i) => {
      for (const attempt of session.questionAttempts) {
        let oIds = attempt.question.questionOutcomes.map((qo) => qo.learningOutcomeId);
        if (oIds.length === 0) {
          oIds = attempt.question.questionTopics.flatMap((qt) =>
            qt.topic.learningOutcomes.map((lo) => lo.id)
          );
        }
        accumulated.push({ isCorrect: attempt.isCorrect, confidence: attempt.confidence, outcomeIds: oIds });
      }

      const scoreMap: Record<string, { sum: number; count: number }> = {};
      for (const a of accumulated) {
        const s = weightedScore(a.isCorrect, a.confidence);
        for (const oid of a.outcomeIds) {
          if (!scoreMap[oid]) scoreMap[oid] = { sum: 0, count: 0 };
          scoreMap[oid].sum += s;
          scoreMap[oid].count += 1;
        }
      }

      // Use outcomes that were actually touched if none are defined on the course yet
      const idsToScore =
        allOutcomeIds.length > 0 ? allOutcomeIds : Object.keys(scoreMap);

      const scored = idsToScore
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

  return NextResponse.json({
    id: course.id,
    name: course.name,
    code: course.code,
    isArchived: course.isArchived,
    courseMastery,
    topics,
    masteryHistory,
  });
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const supabase = await createClient();
  const user = await getPrismaUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await prisma.course.updateMany({
    where: { id: courseId, userId: user.id },
    data: { isArchived: true },
  });

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const supabase = await createClient();
  const user = await getPrismaUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const outcomeIds = (await prisma.learningOutcome.findMany({ where: { courseId }, select: { id: true } })).map((o) => o.id);
  const questionIds = (await prisma.question.findMany({ where: { courseId }, select: { id: true } })).map((q) => q.id);
  const sessionIds = (await prisma.studySession.findMany({ where: { courseId }, select: { id: true } })).map((s) => s.id);

  await prisma.questionAttempt.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.masteryScore.deleteMany({ where: { learningOutcomeId: { in: outcomeIds } } });
  await prisma.questionOutcome.deleteMany({ where: { questionId: { in: questionIds } } });
  await prisma.questionTopic.deleteMany({ where: { questionId: { in: questionIds } } });
  await prisma.question.deleteMany({ where: { courseId } });
  await prisma.studySession.deleteMany({ where: { courseId } });
  await prisma.learningOutcome.deleteMany({ where: { courseId } });
  await prisma.topic.deleteMany({ where: { courseId } });
  await prisma.document.deleteMany({ where: { courseId } });
  await prisma.course.delete({ where: { id: courseId } });

  return NextResponse.json({ success: true });
}