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

  const { filePath, fileName, purpose } = await req.json();

  if (!filePath) return NextResponse.json({ error: "No filePath" }, { status: 400 });
  if (!fileName) return NextResponse.json({ error: "No fileName" }, { status: 400 });
  if (!purpose) return NextResponse.json({ error: "No purpose" }, { status: 400 });

  // Ensure the path belongs to this course — prevents pointing at another user's files
  if (!filePath.startsWith(`${courseId}/`)) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  if (!(VALID_PURPOSES as readonly string[]).includes(purpose)) {
    return NextResponse.json(
      { error: `purpose must be one of: ${VALID_PURPOSES.join(", ")}` },
      { status: 400 }
    );
  }
  const validPurpose = purpose as DocumentPurpose;

  const document = await prisma.document.create({
    data: {
      name: fileName,
      fileUrl: filePath,
      fileType: "application/pdf",
      purpose: validPurpose,
      courseId,
    },
  });

  if (validPurpose === "outcomes") {
    try {
      const { data: blob, error: downloadError } = await serviceClient.storage
        .from("course-documents")
        .download(filePath);

      if (downloadError || !blob) {
        console.error("Outcomes: download failed:", downloadError);
        return NextResponse.json({ document, shouldPreview: false, extractionError: "Download failed" });
      }

      const fileBuffer = await blob.arrayBuffer();
      const base64 = Buffer.from(new Uint8Array(fileBuffer)).toString("base64");

      const prompt = `You are analyzing a university course document. Extract the learning outcomes and group them by their actual subject topic or unit.

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
- Name each topic after the actual subject matter it covers — e.g. "Requirements Engineering", "User Stories", "Software Process Models" — NOT structural labels like "Course Learning Objectives", "Lecture Outcomes", or "Module 1"
- Infer the topic name from slide headings, section titles, or the dominant subject of a group of slides/pages
- Each topic must represent a coherent subject area, not a document section or administrative grouping
- When multiple closely related subtopics cluster naturally under a broader theme, group them under that theme rather than listing each separately (e.g. prefer "Software Testing Techniques" over separate "Black Box Testing" and "Boundary Value Analysis" topics)
- Each outcome must be specific and testable: a concrete statement of what a student should be able to do or know after studying that topic
- Ignore administrative content: quiz mechanics, grading policies, break slides, project deadlines, housekeeping announcements
- If outcomes from different pages clearly belong to the same subject area, merge them under one topic
- If no clear topics exist, use a single topic named after the document's core subject
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
      const { data: blob, error: downloadError } = await serviceClient.storage
        .from("course-documents")
        .download(filePath);

      if (downloadError || !blob) {
        console.error("Quiz: download failed:", downloadError);
        return NextResponse.json({ document, shouldPreviewQuestions: false });
      }

      const fileBuffer = await blob.arrayBuffer();
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

  if (validPurpose === "lecture") {
    try {
      const { data: blob, error: downloadError } = await serviceClient.storage
        .from("course-documents")
        .download(filePath);

      if (downloadError || !blob) {
        console.error("Lecture LO extraction: download failed:", downloadError);
        return NextResponse.json({ document, shouldPreview: false });
      }

      const fileBuffer = await blob.arrayBuffer();
      const base64 = Buffer.from(new Uint8Array(fileBuffer)).toString("base64");

      const prompt = `You are analyzing a university lecture document. Look for explicit sections that list learning outcomes or objectives (e.g. sections titled "Learning Outcomes", "Learning Objectives", "By the end of this lecture you will…", or similar).

If such sections exist, extract ONLY what is written there — do not infer or derive outcomes from the lecture content itself.

If no such section exists, return an empty topics array.

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
- Only populate this if you find an explicit outcomes/objectives section in the document
- If no such section exists, return { "topics": [] }
- Name each topic after the actual subject matter it covers — e.g. "Requirements Engineering", "User Stories", "Agile Methods" — NOT structural labels like "Lecture Outcomes", "Learning Objectives", or "Week 3"
- Infer the topic name from the lecture title, slide headings, or the dominant subject of the section where the outcomes appear
- Each topic must represent a coherent subject area, not a document section or structural label
- When multiple closely related subtopics cluster naturally under a broader theme, group them under that theme rather than listing each separately
- Each outcome must be specific and testable: a concrete statement of what a student should be able to do or know
- Ignore administrative content: quiz mechanics, grading policies, break slides, project deadlines
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

      try {
        const clean = text.replace(/```json|```/g, "").trim();
        const extracted = JSON.parse(clean) as { topics?: Array<{ name: string; outcomes: string[] }> };
        const topics = extracted.topics ?? [];

        if (topics.length > 0) {
          return NextResponse.json({ document, extracted, shouldPreview: true });
        }
      } catch (parseErr) {
        console.error("Lecture LO extraction: JSON parse failed:", parseErr, "\nRaw:", text.slice(0, 500));
      }
    } catch (err) {
      console.error("Lecture LO extraction error:", err);
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

  try {
    await prisma.topic.deleteMany({ where: { documentId } });
    await prisma.question.deleteMany({ where: { documentId, courseId } });
    await prisma.document.delete({ where: { id: documentId } });
  } catch (err) {
    console.error("Document delete DB error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
