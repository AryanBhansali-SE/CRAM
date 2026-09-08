import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsage } from "@/lib/limits";

/**
 * The caller's tier and current consumption.
 *
 * The workspace gets its numbers from the document and query responses during
 * normal use; this exists for a cold refresh, and to make the limits easy to
 * inspect by hand while testing.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    return NextResponse.json({ usage: await getUsage(supabase, user) });
  } catch (err) {
    console.error("Usage read error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
