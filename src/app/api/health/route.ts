import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "Supabase environment variables are missing" },
      { status: 503 },
    );
  }

  try {
    const { error } = await supabase.from("settings").select("key").limit(1);
    if (error) {
      return Response.json(
        { ok: false, error: error.message },
        { status: 503 },
      );
    }
    return Response.json({ ok: true, provider: "supabase" });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 503 },
    );
  }
}
