import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embed } from "@/lib/gemini";
import {
  documentsRemaining,
  getUsage,
  limitPayload,
  withDocumentsAdded,
} from "@/lib/limits";
import PDFParser from "pdf2json";
import type { SupabaseClient } from "@supabase/supabase-js";

// How many chunk embeddings to request at once. Keeps a syllabus-sized upload
// from taking forever without hammering the embedding API.
const EMBED_CONCURRENCY = 4;

type IngestResult = {
  documentId: string;
  filename: string;
  chunks: number;
  createdAt: string;
};

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // pdf2json surfaces errors already prefixed with "Error:"; don't stack them.
  return message.replace(/^(Error:\s*)+/, "");
}

// pdf2json pads its raw text output with page-break markers and long runs of
// whitespace. Left alone, those produce chunks that are entirely blank — each
// one costing an embedding call and then competing for a slot in retrieval.
const PAGE_BREAK = /-*\s*Page \(\d+\) Break\s*-*/g;

function hasContent(chunk: string): boolean {
  return chunk.replace(PAGE_BREAK, "").trim().length > 0;
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const size = 1000;
  const overlap = 200;
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.filter(hasContent);
}

// Extract text from a PDF buffer using pdf2json (no worker needed).
function extractText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true);
    parser.on("pdfParser_dataError", (err) =>
      reject(err instanceof Error ? err : err.parserError)
    );
    parser.on("pdfParser_dataReady", () => resolve(parser.getRawTextContent()));
    parser.parseBuffer(buffer);
  });
}

// Embed every chunk, a few at a time, preserving order.
async function embedAll(chunks: string[]): Promise<number[][]> {
  const embeddings: number[][] = new Array(chunks.length);
  for (let start = 0; start < chunks.length; start += EMBED_CONCURRENCY) {
    const slice = chunks.slice(start, start + EMBED_CONCURRENCY);
    const results = await Promise.all(slice.map((c) => embed(c)));
    results.forEach((e, i) => {
      embeddings[start + i] = e;
    });
  }
  return embeddings;
}

// Ingest one PDF into its own documents row plus its chunks.
async function ingestFile(
  supabase: SupabaseClient,
  file: File,
  userId: string
): Promise<IngestResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractText(buffer);

  if (!text || !text.trim()) {
    throw new Error("No text found in PDF");
  }

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({ user_id: userId, filename: file.name })
    .select()
    .single();

  if (docError) throw docError;

  try {
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("No readable text found in PDF");
    }

    const embeddings = await embedAll(chunks);

    const { error: chunkError } = await supabase.from("chunks").insert(
      chunks.map((content, i) => ({
        document_id: doc.id,
        content,
        embedding: embeddings[i],
      }))
    );

    if (chunkError) throw chunkError;

    return {
      documentId: doc.id,
      filename: file.name,
      chunks: chunks.length,
      createdAt: doc.created_at,
    };
  } catch (err) {
    // Don't leave a half-ingested document behind in the sidebar.
    await supabase.from("chunks").delete().eq("document_id", doc.id);
    await supabase.from("documents").delete().eq("id", doc.id);
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Identity comes from the verified session, never from the form body.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const userId = user.id;

    const formData = await req.formData();

    // "files" is the multi-upload field; "file" is kept for the original
    // single-file callers.
    const files = [...formData.getAll("files"), ...formData.getAll("file")].filter(
      (f): f is File => f instanceof File && f.size > 0
    );

    if (files.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Enforce the document allowance server-side. The dropzone greys itself out
    // at the limit, but this is the check a direct multipart POST runs into.
    const usage = await getUsage(supabase, user);
    const remaining = documentsRemaining(usage);

    if (remaining === 0) {
      return NextResponse.json(limitPayload("document_limit", usage), { status: 403 });
    }

    // A batch that only partly fits: ingest what there's room for and report the
    // rest as refusals, rather than rejecting files we could have accepted.
    const accepted = remaining === null ? files : files.slice(0, remaining);
    const refused = remaining === null ? [] : files.slice(remaining);

    const results: IngestResult[] = [];
    const failures: { filename: string; error: string }[] = refused.map((file) => ({
      filename: file.name,
      error: "Skipped — that would go past your plan's document limit.",
    }));

    // Sequential across files: each PDF already parallelises its own embeddings.
    for (const file of accepted) {
      try {
        results.push(await ingestFile(supabase, file, userId));
      } catch (err) {
        console.error(`Upload error (${file.name}):`, err);
        failures.push({ filename: file.name, error: errorMessage(err) });
      }
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: failures.map((f) => `${f.filename}: ${f.error}`).join("; "), failures },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      documents: results,
      failures,
      usage: withDocumentsAdded(usage, results.length),
      // Set when part of the batch was turned away by the plan limit, so the
      // client knows to raise the upgrade wall after a partial success.
      limitReached: refused.length > 0,
      // Preserved for the original single-file response shape.
      documentId: results[0].documentId,
      chunks: results.reduce((total, r) => total + r.chunks, 0),
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
