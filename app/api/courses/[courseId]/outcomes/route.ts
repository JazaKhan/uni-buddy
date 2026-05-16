import { NextRequest, NextResponse } from "next/server";
import { getPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  let user;
  try { user = await getPrismaUser(); } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, topicId } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!topicId) return NextResponse.json({ error: "topicId required" }, { status: 400 });

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, courseId, course: { userId: user.id } },
  });
  if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const outcome = await prisma.learningOutcome.create({
    data: { name: name.trim(), topicId, courseId },
  });

  return NextResponse.json(outcome, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  let user;
  try { user = await getPrismaUser(); } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { outcomeId } = await req.json();
  if (!outcomeId) return NextResponse.json({ error: "outcomeId required" }, { status: 400 });

  const outcome = await prisma.learningOutcome.findFirst({
    where: { id: outcomeId, courseId, topic: { course: { userId: user.id } } },
  });
  if (!outcome) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.masteryScore.deleteMany({ where: { learningOutcomeId: outcomeId } }),
    prisma.questionOutcome.deleteMany({ where: { learningOutcomeId: outcomeId } }),
    prisma.learningOutcome.delete({ where: { id: outcomeId } }),
  ]);

  return NextResponse.json({ success: true });
}