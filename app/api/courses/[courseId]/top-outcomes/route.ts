import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findFirst({
    where: { id: courseId, userId: user.id },
    include: {
      topics: {
        include: {
          learningOutcomes: {
            include: { masteryScores: { where: { userId: user.id } } },
          },
        },
      },
    },
  });

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const practicedTop10 = course.topics
    .flatMap((topic) =>
      topic.learningOutcomes
        .filter((lo) => lo.masteryScores.length > 0)
        .map((lo) => ({
          id: lo.id,
          name: lo.name,
          description: lo.description,
          mastery: lo.masteryScores[0].score as number,
          practiced: true,
        }))
    )
    .sort((a, b) => a.mastery - b.mastery);

  const practicedIds = new Set(practicedTop10.map((o) => o.id));

  const unpracticed = course.topics.flatMap((topic) =>
    topic.learningOutcomes
      .filter((lo) => !practicedIds.has(lo.id))
      .map((lo) => ({
        id: lo.id,
        name: lo.name,
        description: lo.description,
        mastery: null as number | null,
        practiced: false,
      }))
  );

  const top10 = [...practicedTop10, ...unpracticed].slice(0, 10);

  return NextResponse.json({ top10 });
}
