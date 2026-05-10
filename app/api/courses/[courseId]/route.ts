import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function getPrismaUser(supabase: Awaited<ReturnType<typeof createClient>>) {
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
  const supabase = await createClient();
  const user = await getPrismaUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findFirst({
    where: { id: courseId, userId: user.id },
    include: {
      topics: {
        include: {
          learningOutcomes: {
            include: {
              masteryScores: {
                where: { userId: user.id },
              },
            },
          },
        },
      },
    },
  });

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const topics = course.topics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    outcomes: topic.learningOutcomes.map((lo) => ({
      id: lo.id,
      name: lo.name,
      description: lo.description,
      mastery: lo.masteryScores[0]?.score ?? 0,
    })),
  }));

  const allOutcomes = topics.flatMap((t) => t.outcomes);
  const courseMastery =
    allOutcomes.length > 0
      ? Math.round(allOutcomes.reduce((sum, o) => sum + o.mastery, 0) / allOutcomes.length)
      : 0;

  return NextResponse.json({
    id: course.id,
    name: course.name,
    code: course.code,
    isArchived: course.isArchived,
    courseMastery,
    topics,
  });
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const supabase = await createClient();
  const user = await getPrismaUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await prisma.course.updateMany({
    where: { id: courseId, userId: user.id },
    data: { isArchived: true },
  });

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
