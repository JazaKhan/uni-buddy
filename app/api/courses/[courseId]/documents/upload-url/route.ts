import { NextRequest, NextResponse } from "next/server";
import { getPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@/lib/supabase/serviceClient";

const VALID_PURPOSES = ["lecture", "outcomes", "quiz"] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { fileName, purpose } = await req.json();
  if (!fileName || !purpose) {
    return NextResponse.json({ error: "fileName and purpose required" }, { status: 400 });
  }

  if (!(VALID_PURPOSES as readonly string[]).includes(purpose)) {
    return NextResponse.json(
      { error: `purpose must be one of: ${VALID_PURPOSES.join(", ")}` },
      { status: 400 }
    );
  }

  // Strip any path separators to prevent traversal
  const safeName = fileName.replace(/[/\\]/g, "_");
  const filePath = `${courseId}/${Date.now()}-${safeName}`;

  const { data, error } = await serviceClient.storage
    .from("course-documents")
    .createSignedUploadUrl(filePath);

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, filePath, token: data.token });
}
