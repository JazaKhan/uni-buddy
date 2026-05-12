import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

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

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const documents = await prisma.document.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(documents);
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

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const purpose = formData.get("purpose") as string;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!purpose) return NextResponse.json({ error: "No purpose" }, { status: 400 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const fileBuffer = await file.arrayBuffer();
  const fileName = `${courseId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await serviceClient.storage
    .from("course-documents")
    .upload(fileName, fileBuffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed", detail: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = serviceClient.storage
    .from("course-documents")
    .getPublicUrl(fileName);

  const document = await prisma.document.create({
    data: {
      name: file.name,
      fileUrl: publicUrl,
      fileType: file.type,
      purpose,
      courseId,
    },
  });

  if (purpose === "outcomes") {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const base64 = Buffer.from(new Uint8Array(fileBuffer)).toString("base64");

      const prompt = `You are analyzing a university course document. Extract the learning outcomes and topics from this document.

Return ONLY a valid JSON object in this exact format, no other text:
{
  "topics": [
    {
      "name": "Topic name",
      "outcomes": [
        "Learning outcome 1",
        "Learning outcome 2"
      ]
    }
  ]
}

Rules:
- Group outcomes under their relevant topic
- Each outcome should be a clear, concise statement of what a student should know or be able to do
- If no clear topics exist, use a single topic named after the document subject
- Maximum 10 topics, maximum 8 outcomes per topic`;

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const clean = text.replace(/```json|```/g, "").trim();
      const extracted = JSON.parse(clean);

      return NextResponse.json({ document, extracted, shouldPreview: true });
    } catch (err) {
      console.error("Extraction error:", err);
      return NextResponse.json({ document, shouldPreview: false, extractionError: String(err) });
    }
  }

  return NextResponse.json({ document, shouldPreview: false });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId } = await req.json();
  if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

  const doc = await prisma.document.findFirst({
    where: { id: documentId, courseId, course: { userId: user.id } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const filePath = doc.fileUrl.split("/course-documents/")[1];
  await serviceClient.storage.from("course-documents").remove([filePath]);

  await prisma.document.delete({ where: { id: documentId } });

  return NextResponse.json({ success: true });
}
