import { prisma } from "@/lib/prisma";
import { serviceClient } from "@/lib/supabase/serviceClient";

export type DocBlock = {
  type: "document";
  source: { type: "base64"; media_type: "application/pdf"; data: string };
};

const FOUR_MB = 4 * 1024 * 1024;
const TEN_MB_BASE64 = 10 * 1024 * 1024;

function normaliseStoragePath(fileUrl: string): string | null {
  if (!fileUrl.startsWith("http")) return fileUrl;
  const parts = fileUrl.split("/course-documents/");
  return parts.length === 2 ? parts[1] : null;
}

export async function loadDocumentBlocks(
  courseId: string,
  purposes: string[],
  take = 3
): Promise<DocBlock[]> {
  const documents = await prisma.document.findMany({
    where: { courseId, purpose: { in: purposes }, isActive: true },
    orderBy: { createdAt: "desc" },
    take,
  });

  console.error(`docLoader: found ${documents.length} active doc(s) for courseId=${courseId} purposes=${purposes.join(",")}`);

  const blocks = await Promise.all(
    documents.map(async (doc) => {
      const storagePath = normaliseStoragePath(doc.fileUrl);
      if (!storagePath) {
        console.error(`docLoader: could not normalise path for doc ${doc.id} fileUrl=${doc.fileUrl}`);
        return null;
      }

      try {
        const { data, error } = await serviceClient.storage
          .from("course-documents")
          .createSignedUrl(storagePath, 60);

        if (error || !data?.signedUrl) {
          console.error(`docLoader: createSignedUrl failed for doc ${doc.id} path=${storagePath}:`, error);
          return null;
        }

        const res = await fetch(data.signedUrl, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) {
          console.error(`docLoader: fetch failed for doc ${doc.id}: HTTP ${res.status}`);
          return null;
        }

        const buf = await res.arrayBuffer();
        if (buf.byteLength > FOUR_MB) {
          console.error("DOC LOADER: skipping doc, too large:", doc.name, buf.byteLength, "bytes");
          return null;
        }

        console.error(`docLoader: loaded doc ${doc.id} (${buf.byteLength} bytes)`);
        return {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: Buffer.from(buf).toString("base64"),
          },
        };
      } catch (err) {
        console.error(`docLoader: exception loading doc ${doc.id} path=${storagePath}:`, err);
        return null;
      }
    })
  );

  const loaded = blocks.filter((b): b is DocBlock => b !== null);

  // Cap total payload sent to Anthropic — base64 is ~4/3× the raw size
  let totalBase64 = 0;
  const capped: DocBlock[] = [];
  for (const block of loaded) {
    const blockSize = block.source.data.length;
    if (totalBase64 + blockSize > TEN_MB_BASE64) {
      console.error(`docLoader: total payload would exceed 10MB base64, stopping at ${capped.length} doc(s)`);
      break;
    }
    totalBase64 += blockSize;
    capped.push(block);
  }

  console.error(`docLoader: returning ${capped.length}/${documents.length} doc block(s) (${totalBase64} base64 bytes)`);
  return capped;
}
