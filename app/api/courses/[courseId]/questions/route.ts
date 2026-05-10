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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify course belongs to user
  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const questions = await prisma.question.findMany({
    where: { courseId },
    include: {
      questionTopics: { include: { topic: true } },
      questionOutcomes: { include: { learningOutcome: true } },
      questionAttempts: true,
    },
    orderBy: { id: "asc" },
  });

  const result = questions.map((q) => {
    const attempts = q.questionAttempts;
    const mastery =
      attempts.length === 0
        ? 0
        : Math.round((attempts.filter((a) => a.isCorrect).length / attempts.length) * 100);

    return {
      id: q.id,
      content: q.content,
      answer: q.answer,
      mastery,
      topics: q.questionTopics.map((qt) => ({ id: qt.topic.id, name: qt.topic.name })),
      outcomes: q.questionOutcomes.map((qo) => ({
        id: qo.learningOutcome.id,
        name: qo.learningOutcome.name,
      })),
    };
  });

  return NextResponse.json(result);
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

  const { content, answer, topicIds, outcomeIds } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });

  const question = await prisma.question.create({
    data: {
      content: content.trim(),
      answer: answer?.trim() || null,
      courseId,
      questionTopics: {
        create: (topicIds ?? []).map((topicId: string) => ({ topicId })),
      },
      questionOutcomes: {
        create: (outcomeIds ?? []).map((learningOutcomeId: string) => ({ learningOutcomeId })),
      },
    },
  });

  return NextResponse.json(question, { status: 201 });
}
