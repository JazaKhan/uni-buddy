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

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const topic = await prisma.topic.create({
    data: { name: name.trim(), courseId },
  });

  return NextResponse.json(topic, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  let user;
  try { user = await getPrismaUser(); } catch { return NextResponse.json({ error: "Server error" }, { status: 500 }); }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { topicId } = await req.json();
  if (!topicId) return NextResponse.json({ error: "topicId required" }, { status: 400 });

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, courseId, course: { userId: user.id } },
  });
  if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const outcomes = await prisma.learningOutcome.findMany({ where: { topicId } });
  const outcomeIds = outcomes.map((o) => o.id);

  await prisma.$transaction([
    prisma.masteryScore.deleteMany({ where: { learningOutcomeId: { in: outcomeIds } } }),
    prisma.questionOutcome.deleteMany({ where: { learningOutcomeId: { in: outcomeIds } } }),
    prisma.learningOutcome.deleteMany({ where: { topicId } }),
    prisma.questionTopic.deleteMany({ where: { topicId } }),
    prisma.topic.delete({ where: { id: topicId } }),
  ]);

  return NextResponse.json({ success: true });
}