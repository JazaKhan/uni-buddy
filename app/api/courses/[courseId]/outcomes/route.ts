import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return null;
  return prisma.user.upsert({
    where: { email: authUser.email },
    update: {},
    create: { email: authUser.email },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getAuthedUser();
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
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { outcomeId } = await req.json();
  if (!outcomeId) return NextResponse.json({ error: "outcomeId required" }, { status: 400 });

  const outcome = await prisma.learningOutcome.findFirst({
    where: { id: outcomeId, courseId, topic: { course: { userId: user.id } } },
  });
  if (!outcome) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Manually cascade: delete join rows first
  await prisma.masteryScore.deleteMany({ where: { learningOutcomeId: outcomeId } });
  await prisma.questionOutcome.deleteMany({ where: { learningOutcomeId: outcomeId } });
  await prisma.learningOutcome.delete({ where: { id: outcomeId } });

  return NextResponse.json({ success: true });
}