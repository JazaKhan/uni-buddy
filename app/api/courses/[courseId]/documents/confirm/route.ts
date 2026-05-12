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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { topics } = await req.json();

  for (const topic of topics) {
    if (!topic.name?.trim() || !topic.selected) continue;

    let existingTopic = await prisma.topic.findFirst({
      where: { courseId, name: topic.name.trim() },
    });

    if (!existingTopic) {
      existingTopic = await prisma.topic.create({
        data: { name: topic.name.trim(), courseId },
      });
    }

    for (const outcome of topic.outcomes) {
      if (!outcome.name?.trim() || !outcome.selected) continue;

      const existing = await prisma.learningOutcome.findFirst({
        where: { courseId, topicId: existingTopic.id, name: outcome.name.trim() },
      });

      if (!existing) {
        await prisma.learningOutcome.create({
          data: {
            name: outcome.name.trim(),
            topicId: existingTopic.id,
            courseId,
          },
        });
      }
    }
  }

  return NextResponse.json({ success: true });
}
