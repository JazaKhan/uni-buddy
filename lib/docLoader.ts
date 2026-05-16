import { prisma } from "@/lib/prisma";
import { serviceClient } from "@/lib/supabase/serviceClient";

export type DocBlock = {
  type: "document";
  source: { type: "base64"; media_type: "application/pdf"; data: string };
};

const TWENTY_MB = 20 * 1024 * 1024;

export async function loadDocumentBlocks(
  courseId: string,
  purposes: string[],
  take?: number
): Promise<DocBlock[]> {
  const documents = await prisma.document.findMany({
    where: { courseId, purpose: { in: purposes }, isActive: true },
    orderBy: { createdAt: "desc" },
    ...(take !== undefined ? { take } : {}),
  });

  const blocks = await Promise.all(
    documents.map(async (doc) => {
      try {
        const { data, error } = await serviceClient.storage
          .from("course-documents")
          .createSignedUrl(doc.fileUrl, 60);
        if (error || !data?.signedUrl) return null;
        const res = await fetch(data.signedUrl, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        if (buf.byteLength > TWENTY_MB) return null;
        return {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: Buffer.from(buf).toString("base64"),
          },
        };
      } catch {
        return null;
      }
    })
  );

  return blocks.filter((b): b is DocBlock => b !== null);
}
