import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/serviceClient";

function normaliseStoragePath(fileUrl: string): string | null {
  if (!fileUrl.startsWith("http")) return fileUrl;
  const parts = fileUrl.split("/course-documents/");
  return parts.length === 2 ? parts[1] : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const documentId = req.nextUrl.searchParams.get("documentId");
  if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

  const doc = await prisma.document.findFirst({
    where: { id: documentId, courseId, course: { userId: user.id } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const storagePath = normaliseStoragePath(doc.fileUrl);
  if (!storagePath) {
    return NextResponse.json({ error: "Invalid document path" }, { status: 500 });
  }

  const { data, error } = await serviceClient.storage
    .from("course-documents")
    .createSignedUrl(storagePath, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
