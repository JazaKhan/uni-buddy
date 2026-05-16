import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";

const VALID_CONFIDENCE = ["GUESSED", "UNSURE", "CONFIDENT"] as const;
type Confidence = (typeof VALID_CONFIDENCE)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { questionId, isCorrect, confidence } = await req.json();
  if (!questionId || isCorrect === undefined || !confidence)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const raw = String(confidence).toUpperCase();
  if (!(VALID_CONFIDENCE as readonly string[]).includes(raw)) {
    return NextResponse.json(
      { error: `confidence must be one of: ${VALID_CONFIDENCE.join(", ")}` },
      { status: 400 }
    );
  }
  const confidenceEnum = raw as Confidence;

  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.questionAttempt.create({
    data: { sessionId, questionId, isCorrect, confidence: confidenceEnum },
  });

  return NextResponse.json({ success: true });
}
