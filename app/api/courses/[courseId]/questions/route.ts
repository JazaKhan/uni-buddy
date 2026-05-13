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
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify course belongs to user
  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const topicIdsParam = req.nextUrl.searchParams.get("topicIds");
  const outcomeIdsParam = req.nextUrl.searchParams.get("outcomeIds");
  const selectedTopicIds = topicIdsParam ? topicIdsParam.split(",").filter(Boolean) : [];
  const selectedOutcomeIds = outcomeIdsParam ? outcomeIdsParam.split(",").filter(Boolean) : [];

  // Build filter: when IDs are provided, include questions tagged to them OR questions
  // with no tags at all (untagged questions are "general" and appear in every session).
  // When no IDs provided, return everything.
  const topicFilter = selectedTopicIds.length > 0
    ? { OR: [
        { questionTopics: { none: {} } },
        { questionTopics: { some: { topicId: { in: selectedTopicIds } } } },
      ] }
    : {};

  const outcomeFilter = selectedOutcomeIds.length > 0
    ? { OR: [
        { questionOutcomes: { none: {} } },
        { questionOutcomes: { some: { learningOutcomeId: { in: selectedOutcomeIds } } } },
      ] }
    : {};

  const questions = await prisma.question.findMany({
    where: {
      courseId,
      ...(selectedOutcomeIds.length > 0 ? outcomeFilter : topicFilter),
    },
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
      type: q.type,
      options: q.options ?? null,
      blanks: q.blanks ?? null,
      isAiGenerated: q.isAiGenerated,
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

  const { content, answer, topicIds, outcomeIds, type, options, blanks, isAiGenerated } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });

  const topicIdList: string[] = Array.isArray(topicIds) ? topicIds : [];
  const outcomeIdList: string[] = Array.isArray(outcomeIds) ? outcomeIds : [];

  // Validate IDs belong to this course to prevent FK constraint errors
  if (topicIdList.length > 0) {
    const valid = await prisma.topic.findMany({ where: { id: { in: topicIdList }, courseId }, select: { id: true } });
    const validSet = new Set(valid.map((t) => t.id));
    const bad = topicIdList.filter((id) => !validSet.has(id));
    if (bad.length > 0) return NextResponse.json({ error: `Invalid topic IDs: ${bad.join(", ")}` }, { status: 400 });
  }

  if (outcomeIdList.length > 0) {
    const valid = await prisma.learningOutcome.findMany({ where: { id: { in: outcomeIdList }, courseId }, select: { id: true } });
    const validSet = new Set(valid.map((o) => o.id));
    const bad = outcomeIdList.filter((id) => !validSet.has(id));
    if (bad.length > 0) return NextResponse.json({ error: `Invalid outcome IDs: ${bad.join(", ")}` }, { status: 400 });
  }

  try {
    const question = await prisma.question.create({
      data: {
        content: content.trim(),
        answer: answer?.trim() || null,
        type: type ?? "WRITTEN",
        ...(options && { options }),
        ...(blanks && { blanks }),
        isAiGenerated: isAiGenerated === true,
        courseId,
        questionTopics: {
          create: topicIdList.map((topicId) => ({ topicId })),
        },
        questionOutcomes: {
          create: outcomeIdList.map((learningOutcomeId) => ({ learningOutcomeId })),
        },
      },
    });
    return NextResponse.json(question, { status: 201 });
  } catch (err) {
    console.error("Question create error:", JSON.stringify(err, null, 2));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
