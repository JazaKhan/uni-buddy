import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { questions, documentId } = await req.json();
  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  const allOutcomeIds = [...new Set(questions.flatMap((q: { outcomeIds?: string[] }) => q.outcomeIds ?? []))];

  const outcomes = await prisma.learningOutcome.findMany({
    where: { id: { in: allOutcomeIds }, courseId },
    select: { id: true, topicId: true },
  });
  const outcomeTopicMap = new Map(outcomes.map((o) => [o.id, o.topicId]));

  await prisma.$transaction(
    questions.map((q: { content: string; answer: string | null; outcomeIds: string[] }) => {
      const validOutcomeIds = (q.outcomeIds ?? []).filter((id) => outcomeTopicMap.has(id));
      const topicIds = [...new Set(validOutcomeIds.map((id) => outcomeTopicMap.get(id)!))];

      return prisma.question.create({
        data: {
          content: q.content,
          answer: q.answer ?? null,
          courseId,
          ...(documentId ? { documentId } : {}),
          questionOutcomes: {
            create: validOutcomeIds.map((id) => ({ learningOutcomeId: id })),
          },
          questionTopics: {
            create: topicIds.map((topicId) => ({ topicId })),
          },
        },
      });
    })
  );

  return NextResponse.json({ count: questions.length });
}
