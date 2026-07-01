import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; topicId: string }> }
) {
  const { courseId, topicId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, courseId, course: { userId: user.id } },
  });
  if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.topic.update({
    where: { id: topicId },
    data: { name: name.trim() },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; topicId: string }> }
) {
  const { courseId, topicId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, courseId, course: { userId: user.id } },
  });
  if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Collect LOs and questions linked to this topic up front
  const [learningOutcomes, topicQuestions] = await Promise.all([
    prisma.learningOutcome.findMany({ where: { topicId }, select: { id: true } }),
    prisma.questionTopic.findMany({ where: { topicId }, select: { questionId: true } }),
  ]);
  const loIds = learningOutcomes.map((lo) => lo.id);
  const candidateIds = topicQuestions.map((q) => q.questionId);

  // Questions belong to Course (not Topic), so they must be cleaned up manually.
  // Only delete questions that are not linked to any other topic.
  let exclusiveQuestionIds: string[] = [];
  if (candidateIds.length > 0) {
    const linkedElsewhere = await prisma.questionTopic.findMany({
      where: { questionId: { in: candidateIds }, topicId: { not: topicId } },
      select: { questionId: true },
    });
    const survivingIds = new Set(linkedElsewhere.map((q) => q.questionId));
    exclusiveQuestionIds = candidateIds.filter((id) => !survivingIds.has(id));
  }

  // 1. Delete LO dependents (MasteryScore, QuestionOutcome via loId)
  if (loIds.length > 0) {
    await prisma.masteryScore.deleteMany({ where: { learningOutcomeId: { in: loIds } } });
    await prisma.questionOutcome.deleteMany({ where: { learningOutcomeId: { in: loIds } } });
  }

  // 2. Delete exclusive-question dependents (QuestionAttempt, any remaining QuestionOutcome)
  if (exclusiveQuestionIds.length > 0) {
    await prisma.questionAttempt.deleteMany({ where: { questionId: { in: exclusiveQuestionIds } } });
    await prisma.questionOutcome.deleteMany({ where: { questionId: { in: exclusiveQuestionIds } } });
  }

  // 3. Remove all QuestionTopic rows for this topic (exclusive and shared questions)
  await prisma.questionTopic.deleteMany({ where: { topicId } });

  // 4. Delete exclusive questions and LOs
  if (exclusiveQuestionIds.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: exclusiveQuestionIds } } });
  }
  if (loIds.length > 0) {
    await prisma.learningOutcome.deleteMany({ where: { topicId } });
  }

  await prisma.topic.delete({ where: { id: topicId } });

  return NextResponse.json({ success: true });
}
