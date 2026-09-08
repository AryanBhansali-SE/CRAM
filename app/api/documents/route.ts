import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DocumentRow = {
  id: string;
  filename: string;
  created_at: string;
  chunks: { count: number }[];
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// List the user's uploaded documents, newest first, with their chunk counts.
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const userId = user.id;

    const { data, error } = await supabase
      .from("documents")
      .select("id, filename, created_at, chunks(count)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      documents: ((data ?? []) as unknown as DocumentRow[]).map((doc) => ({
        documentId: doc.id,
        filename: doc.filename,
        createdAt: doc.created_at,
        chunks: doc.chunks?.[0]?.count ?? 0,
      })),
    });
  } catch (err) {
    console.error("Documents list error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

// Remove one document and every chunk that belongs to it.
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const userId = user.id;

    const documentId = req.nextUrl.searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json({ error: "No documentId provided" }, { status: 400 });
    }

    // Confirm the document belongs to this user before deleting anything.
    const { data: doc, error: lookupError } = await supabase
      .from("documents")
      .select("id")
      .eq("id", documentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Chunks first, so a failure can never orphan them.
    const { error: chunkError } = await supabase
      .from("chunks")
      .delete()
      .eq("document_id", documentId);

    if (chunkError) throw chunkError;

    const { error: docError } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", userId);

    if (docError) throw docError;

    return NextResponse.json({ success: true, documentId });
  } catch (err) {
    console.error("Document delete error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
