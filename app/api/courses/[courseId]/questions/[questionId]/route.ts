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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; questionId: string }> }
) {
  const { courseId, questionId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.question.findFirst({
    where: { id: questionId, courseId, course: { userId: user.id } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { content, answer, type, options, blanks, outcomeIds, topicIds } = await req.json();

  const updated = await prisma.$transaction(async (tx) => {
    const q = await tx.question.update({
      where: { id: questionId },
      data: {
        ...(content !== undefined && { content: content.trim() }),
        ...(answer !== undefined && { answer: answer?.trim() || null }),
        ...(type !== undefined && { type }),
        ...(options !== undefined && { options }),
        ...(blanks !== undefined && { blanks }),
      },
    });

    if (outcomeIds !== undefined) {
      await tx.questionOutcome.deleteMany({ where: { questionId } });
      if (outcomeIds.length > 0) {
        await tx.questionOutcome.createMany({
          data: (outcomeIds as string[]).map((learningOutcomeId) => ({ questionId, learningOutcomeId })),
        });
      }
    }

    if (topicIds !== undefined) {
      await tx.questionTopic.deleteMany({ where: { questionId } });
      if (topicIds.length > 0) {
        await tx.questionTopic.createMany({
          data: (topicIds as string[]).map((topicId) => ({ questionId, topicId })),
        });
      }
    }

    return q;
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; questionId: string }> }
) {
  const { courseId, questionId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.question.findFirst({
    where: { id: questionId, courseId, course: { userId: user.id } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.questionOutcome.deleteMany({ where: { questionId } });
  await prisma.questionTopic.deleteMany({ where: { questionId } });
  await prisma.questionAttempt.deleteMany({ where: { questionId } });
  await prisma.question.delete({ where: { id: questionId } });

  return NextResponse.json({ success: true });
}
