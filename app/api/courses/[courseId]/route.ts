import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getPrismaUser();
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
      hasMastery: lo.masteryScores.length > 0,
    })),
  }));

  const allOutcomes = topics.flatMap((t) => t.outcomes);
  const practicedOutcomes = allOutcomes.filter((o) => o.hasMastery);
  const courseMastery =
    practicedOutcomes.length > 0
      ? Math.round(practicedOutcomes.reduce((sum, o) => sum + o.mastery, 0) / practicedOutcomes.length)
      : 0;

  return NextResponse.json({
    id: course.id,
    name: course.name,
    code: course.code,
    credits: course.credits,
    isArchived: course.isArchived,
    courseMastery,
    topics,
  });
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getPrismaUser();
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
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Pre-fetch IDs needed for targeted deletes, in parallel
  const [outcomeIds, questionIds, sessionIds] = await Promise.all([
    prisma.learningOutcome.findMany({ where: { courseId }, select: { id: true } }).then((r) => r.map((o) => o.id)),
    prisma.question.findMany({ where: { courseId }, select: { id: true } }).then((r) => r.map((q) => q.id)),
    prisma.studySession.findMany({ where: { courseId }, select: { id: true } }).then((r) => r.map((s) => s.id)),
  ]);

  // All deletes in a single transaction — if any step fails the whole operation rolls back
  await prisma.$transaction([
    prisma.questionAttempt.deleteMany({ where: { sessionId: { in: sessionIds } } }),
    prisma.masteryScore.deleteMany({ where: { learningOutcomeId: { in: outcomeIds } } }),
    prisma.questionOutcome.deleteMany({ where: { questionId: { in: questionIds } } }),
    prisma.questionTopic.deleteMany({ where: { questionId: { in: questionIds } } }),
    prisma.question.deleteMany({ where: { courseId } }),
    prisma.studySession.deleteMany({ where: { courseId } }),
    prisma.learningOutcome.deleteMany({ where: { courseId } }),
    prisma.topic.deleteMany({ where: { courseId } }),
    prisma.document.deleteMany({ where: { courseId } }),
    prisma.course.delete({ where: { id: courseId } }),
  ]);

  return NextResponse.json({ success: true });
}
