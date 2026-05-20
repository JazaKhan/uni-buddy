import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrismaUser } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/serviceClient";
import { anthropic } from "@/lib/anthropic";

const VALID_PURPOSES = ["lecture", "outcomes", "quiz"] as const;
type DocumentPurpose = (typeof VALID_PURPOSES)[number];

function normaliseStoragePath(fileUrl: string): string | null {
  if (!fileUrl.startsWith("http")) return fileUrl;
  const parts = fileUrl.split("/course-documents/");
  return parts.length === 2 ? parts[1] : null;
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

  if (!(VALID_PURPOSES as readonly string[]).includes(purpose)) {
    return NextResponse.json(
      { error: `purpose must be one of: ${VALID_PURPOSES.join(", ")}` },
      { status: 400 }
    );
  }
  const validPurpose = purpose as DocumentPurpose;

  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large — maximum size is 25 MB" }, { status: 413 });
  }

  const fileBuffer = await file.arrayBuffer();

  const magic = new Uint8Array(fileBuffer, 0, 5);
  const isPdf = magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46 && magic[4] === 0x2D;
  if (!isPdf) {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 415 });
  }

  const fileName = `${courseId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await serviceClient.storage
    .from("course-documents")
    .upload(fileName, fileBuffer, { contentType: "application/pdf" });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed", detail: uploadError.message }, { status: 500 });
  }

  const document = await prisma.document.create({
    data: {
      name: file.name,
      fileUrl: fileName,
      fileType: "application/pdf",
      purpose: validPurpose,
      courseId,
    },
  });

  if (validPurpose === "outcomes") {
    try {
      const base64 = Buffer.from(new Uint8Array(fileBuffer)).toString("base64");

      const prompt = `You are analyzing a university course document. Extract the learning outcomes and topics from this document.

Extract ONLY what is explicitly stated in this document — do not infer, add context, or use outside knowledge.

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
- Each outcome should be a clear, concise statement of what a student should know or be able to do — copied or closely paraphrased from the document
- If no clear topics exist, use a single topic named after the document subject
- Maximum 10 topics, maximum 8 outcomes per topic`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";

      let extracted: unknown;
      try {
        const clean = text.replace(/```json|```/g, "").trim();
        extracted = JSON.parse(clean);
      } catch (parseErr) {
        console.error("Outcomes extraction: JSON parse failed:", parseErr, "\nRaw:", text.slice(0, 500));
        return NextResponse.json({ document, shouldPreview: false, extractionError: "Invalid JSON from AI" });
      }

      return NextResponse.json({ document, extracted, shouldPreview: true });
    } catch (err) {
      console.error("Extraction error:", err);
      return NextResponse.json({ document, shouldPreview: false, extractionError: String(err) });
    }
  }

  if (validPurpose === "quiz") {
    try {
      const base64 = Buffer.from(new Uint8Array(fileBuffer)).toString("base64");

      const courseOutcomes = await prisma.learningOutcome.findMany({
        where: { courseId },
        select: { id: true, name: true, topic: { select: { name: true } } },
      });

      const outcomeList = courseOutcomes.length > 0
        ? courseOutcomes.map((o) => `- ID: ${o.id} | Topic: ${o.topic.name} | Outcome: ${o.name}`).join("\n")
        : null;

      const prompt = `You are analyzing a university exam or quiz document. Extract every practice question from this document.

Extract ONLY what is explicitly stated in this document — do not infer, add context, or use outside knowledge.
${outcomeList
  ? `\nThe course has these learning outcomes:\n${outcomeList}\n\nFor each question, map it to the most relevant outcome IDs from the list above. Only use IDs from the list.`
  : "\nThe course has no learning outcomes yet — set outcomeIds to [] for all questions."}

Return ONLY a valid JSON object in this exact format, no other text:
{
  "questions": [
    {
      "content": "Full question text including any sub-parts",
      "answer": "Answer if visible in the document, otherwise null",
      "outcomeIds": ["outcomeId1"],
      "outcomeSummary": "Brief description of what this question tests"
    }
  ]
}

Rules:
- Include every distinct question in the document
- Preserve full question text including any sub-parts (a, b, c etc.)
- If an answer key is present in the document, include it; otherwise use null
- outcomeIds must only contain IDs from the provided list; use [] if nothing matches
- outcomeSummary should be a single sentence describing the skill or concept tested`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";

      let extracted: { questions?: unknown[] };
      try {
        const clean = text.replace(/```json|```/g, "").trim();
        extracted = JSON.parse(clean);
      } catch (parseErr) {
        console.error("Quiz extraction: JSON parse failed:", parseErr, "\nRaw:", text.slice(0, 500));
        return NextResponse.json({ document, shouldPreviewQuestions: false });
      }

      return NextResponse.json({ document, extractedQuestions: extracted.questions, shouldPreviewQuestions: true });
    } catch (err) {
      console.error("Quiz extraction error:", err);
      return NextResponse.json({ document, shouldPreviewQuestions: false });
    }
  }

  return NextResponse.json({ document, shouldPreview: false });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const user = await getPrismaUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId, isActive } = await req.json();
  if (!documentId || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "documentId and isActive required" }, { status: 400 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: documentId, courseId, course: { userId: user.id } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { isActive },
  });

  return NextResponse.json(updated);
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

  const storagePath = normaliseStoragePath(doc.fileUrl);
  if (storagePath) {
    try {
      const { error: removeError } = await serviceClient.storage
        .from("course-documents")
        .remove([storagePath]);
      if (removeError) console.error("Storage remove failed:", removeError.message);
    } catch (err) {
      console.error("Storage remove threw:", err);
    }
  } else {
    console.error("Could not derive storage path from fileUrl:", doc.fileUrl);
  }

  await prisma.document.delete({ where: { id: documentId } });

  return NextResponse.json({ success: true });
}
