import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("q") ?? "";
  const query = raw.replace(/[^\p{L}\p{N} \-]/gu, "").trim().slice(0, 60);
  if (query.length < 2) return Response.json({ players: [] });

  const supabase = await createClient();
  const terms = query.split(/\s+/).slice(0, 2);
  const base = supabase.from("players").select("id,first_name,last_name");

  const result = terms.length === 2
    ? await base
        .ilike("first_name", `%${terms[0]}%`)
        .ilike("last_name", `%${terms[1]}%`)
        .order("last_name")
        .limit(12)
    : await base
        .or(`first_name.ilike.%${terms[0]}%,last_name.ilike.%${terms[0]}%`)
        .order("last_name")
        .limit(12);

  if (result.error) {
    console.error("Player lookup failed:", result.error);
    return Response.json({ error: "Could not search players" }, { status: 500 });
  }
  return Response.json({ players: result.data ?? [] });
}
