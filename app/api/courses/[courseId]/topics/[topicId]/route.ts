import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";

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

  // Questions belong to Course directly (not Topic), so cascade won't touch them.
  // Manually delete questions that exist exclusively under this topic.
  const topicQuestions = await prisma.questionTopic.findMany({
    where: { topicId },
    select: { questionId: true },
  });
  const candidateIds = topicQuestions.map((q) => q.questionId);

  if (candidateIds.length > 0) {
    const linkedElsewhere = await prisma.questionTopic.findMany({
      where: { questionId: { in: candidateIds }, topicId: { not: topicId } },
      select: { questionId: true },
    });
    const survivingIds = new Set(linkedElsewhere.map((q) => q.questionId));
    const toDeleteIds = candidateIds.filter((id) => !survivingIds.has(id));

    if (toDeleteIds.length > 0) {
      await prisma.questionAttempt.deleteMany({ where: { questionId: { in: toDeleteIds } } });
      await prisma.questionOutcome.deleteMany({ where: { questionId: { in: toDeleteIds } } });
      await prisma.questionTopic.deleteMany({ where: { questionId: { in: toDeleteIds } } });
      await prisma.question.deleteMany({ where: { id: { in: toDeleteIds } } });
    }
  }

  await prisma.topic.delete({ where: { id: topicId } });

  return NextResponse.json({ success: true });
}
