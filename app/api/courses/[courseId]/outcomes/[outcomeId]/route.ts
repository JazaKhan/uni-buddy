import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";

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
