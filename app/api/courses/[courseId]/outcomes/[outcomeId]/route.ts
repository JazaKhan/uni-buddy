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
  { params }: { params: Promise<{ courseId: string; outcomeId: string }> }
) {
  const { courseId, outcomeId } = await params;
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const outcome = await prisma.learningOutcome.findFirst({
    where: { id: outcomeId, courseId, topic: { course: { userId: user.id } } },
  });
  if (!outcome) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.masteryScore.deleteMany({ where: { learningOutcomeId: outcomeId } });
  await prisma.questionOutcome.deleteMany({ where: { learningOutcomeId: outcomeId } });
  await prisma.learningOutcome.delete({ where: { id: outcomeId } });

  return NextResponse.json({ success: true });
}
