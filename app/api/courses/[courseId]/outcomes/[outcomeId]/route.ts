import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; outcomeId: string }> }
) {
  const { courseId, outcomeId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { topicId } = await req.json();
  if (!topicId) return NextResponse.json({ error: "topicId is required" }, { status: 400 });

  const outcome = await prisma.learningOutcome.findFirst({
    where: { id: outcomeId, courseId, topic: { course: { userId: user.id } } },
  });
  if (!outcome) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const targetTopic = await prisma.topic.findFirst({
    where: { id: topicId, courseId },
  });
  if (!targetTopic) return NextResponse.json({ error: "Target topic not found" }, { status: 404 });

  const updated = await prisma.learningOutcome.update({
    where: { id: outcomeId },
    data: { topicId },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; outcomeId: string }> }
) {
  const { courseId, outcomeId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const outcome = await prisma.learningOutcome.findFirst({
    where: { id: outcomeId, courseId, topic: { course: { userId: user.id } } },
  });
  if (!outcome) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.learningOutcome.delete({ where: { id: outcomeId } });

  return NextResponse.json({ success: true });
}
