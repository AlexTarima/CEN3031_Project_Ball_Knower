import { createClient } from "@/lib/supabase/server";
import { predictMatch, type PlayerModelFeatures, type Surface } from "@/lib/model/predict";

const SURFACES: Surface[] = ["All", "Hard", "Clay", "Grass", "Carpet"];

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  const idA = payload.playerAId;
  const idB = payload.playerBId;
  const surface = payload.surface;
  if (
    typeof idA !== "number" || typeof idB !== "number" ||
    !Number.isSafeInteger(idA) || !Number.isSafeInteger(idB) ||
    idA <= 0 || idB <= 0 || idA === idB ||
    typeof surface !== "string" || !SURFACES.includes(surface as Surface)
  ) {
    return Response.json({ error: "Select two different players and a valid surface" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_model_features")
    .select("*")
    .in("player_id", [idA, idB]);
  if (error) {
    console.error("Feature lookup failed:", error);
    return Response.json({ error: "Could not load model features" }, { status: 500 });
  }

  const a = (data ?? []).find((item) => Number(item.player_id) === idA);
  const b = (data ?? []).find((item) => Number(item.player_id) === idB);
  if (!a || !b) {
    return Response.json({ error: "Model features missing. Run the feature-building script." }, { status: 404 });
  }

  const player1 = Math.min(idA, idB);
  const player2 = Math.max(idA, idB);
  const { data: h2h, error: h2hError } = await supabase
    .from("model_head_to_head")
    .select("player1_wins,player2_wins")
    .eq("player1_id", player1)
    .eq("player2_id", player2)
    .maybeSingle();
  if (h2hError) {
    console.error("H2H lookup failed:", h2hError);
    return Response.json({ error: "Could not load head-to-head history" }, { status: 500 });
  }

  const aWins = idA === player1 ? (h2h?.player1_wins ?? 0) : (h2h?.player2_wins ?? 0);
  const bWins = idB === player1 ? (h2h?.player1_wins ?? 0) : (h2h?.player2_wins ?? 0);
  const prediction = predictMatch(
    a as PlayerModelFeatures, b as PlayerModelFeatures,
    surface as Surface, aWins, bWins,
  );
  return Response.json({
    ...prediction,
    priorMeetings: aWins + bWins,
    playerAMatches: a.matches_played,
    playerBMatches: b.matches_played,
  });
}
