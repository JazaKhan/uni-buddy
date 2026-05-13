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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; topicId: string }> }
) {
  const { courseId, topicId } = await params;
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, courseId, course: { userId: user.id } },
  });
  if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const outcomes = await prisma.learningOutcome.findMany({ where: { topicId } });
  const outcomeIds = outcomes.map((o) => o.id);

  await prisma.masteryScore.deleteMany({ where: { learningOutcomeId: { in: outcomeIds } } });
  await prisma.questionOutcome.deleteMany({ where: { learningOutcomeId: { in: outcomeIds } } });
  await prisma.learningOutcome.deleteMany({ where: { topicId } });
  await prisma.questionTopic.deleteMany({ where: { topicId } });
  await prisma.topic.delete({ where: { id: topicId } });

  return NextResponse.json({ success: true });
}
