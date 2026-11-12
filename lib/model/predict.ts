/** Inference-only version of the five-feature Ball Knowers logistic model. */
export type Surface = "All" | "Hard" | "Clay" | "Grass" | "Carpet";

export type PlayerModelFeatures = {
  player_id: number;
  elo_overall: number;
  elo_hard: number;
  elo_clay: number;
  elo_grass: number;
  elo_carpet: number;
  matches_played: number;
  serve_points_won: number;
  serve_points_total: number;
  return_points_won: number;
  return_points_total: number;
};

export type PlayerDisplayStats = {
  effectiveElo: number;
  overallElo: number;
  surfaceElo: number | null;
  matchesPlayed: number;
  headToHeadWins: number;
  servePointsWonPercent: number;
  returnPointsWonPercent: number;
};

export type Prediction = {
  playerAStats: PlayerDisplayStats;
  playerBStats: PlayerDisplayStats;
  probabilityA: number;
  probabilityB: number;
  fairOddsA: number;
  fairOddsB: number;
  lowSample: boolean;
  breakdown: {
    eloDifference: number;
    experienceDifference: number;
    headToHead: number;
    serveDifferencePP: number;
    returnDifferencePP: number;
    logit: number;
  };
};

const INITIAL_ELO = 1500;
const SURFACE_WEIGHT = 0.40;
const PRIOR_POINTS = 20 * 81;  // 1,620 pseudo-points
const SERVE_PRIOR = 0.642;
const RETURN_PRIOR = 0.358;

function effectiveElo(player: PlayerModelFeatures, surface: Surface): number {
  if (surface === "All") return player.elo_overall;
  const column = `elo_${surface.toLowerCase()}` as
    | "elo_hard" | "elo_clay" | "elo_grass" | "elo_carpet";
  // When surface history is absent, the precomputation stores INITIAL_ELO.
  const surfaceElo = player[column] ?? INITIAL_ELO;
  return (1 - SURFACE_WEIGHT) * player.elo_overall + SURFACE_WEIGHT * surfaceElo;
}

function smoothedPercentage(won: number, total: number, prior: number): number {
  // Return percentage POINTS, not a 0..1 fraction, as required by beta_s/r.
  return 100 * (won + PRIOR_POINTS * prior) / (total + PRIOR_POINTS);
}

/**
 * @param a Player A's frozen statistics (only pre-match historical results).
 * @param b Player B's frozen statistics.
 * @param aWins Number of previous matches won by A against B.
 * @param bWins Number of previous matches won by B against A.
 */
export function predictMatch(
  a: PlayerModelFeatures,
  b: PlayerModelFeatures,
  surface: Surface,
  aWins: number,
  bWins: number,
): Prediction {
  // Calculate the same values for inference AND the side-by-side display.
  const eloA = effectiveElo(a, surface);
  const eloB = effectiveElo(b, surface);
  const serveA = smoothedPercentage(a.serve_points_won, a.serve_points_total, SERVE_PRIOR);
  const serveB = smoothedPercentage(b.serve_points_won, b.serve_points_total, SERVE_PRIOR);
  const returnA = smoothedPercentage(a.return_points_won, a.return_points_total, RETURN_PRIOR);
  const returnB = smoothedPercentage(b.return_points_won, b.return_points_total, RETURN_PRIOR);

  const eloDifference = (eloA - eloB) / 100;
  const experienceDifference = Math.log1p(a.matches_played) - Math.log1p(b.matches_played);
  const headToHead = (aWins - bWins) / (aWins + bWins + 2);
  const serveDifferencePP = serveA - serveB;
  const returnDifferencePP = returnA - returnB;

  const logit =
    0.214 * eloDifference +
    0.293 * experienceDifference +
    0.652 * headToHead +
    0.134 * serveDifferencePP +
    0.138 * returnDifferencePP;

  // Stable logistic, clamped only to avoid infinite decimal odds.
  const sigmoid = logit >= 0
    ? 1 / (1 + Math.exp(-logit))
    : Math.exp(logit) / (1 + Math.exp(logit));
  const probabilityA = Math.max(1e-9, Math.min(1 - 1e-9, sigmoid));
  const probabilityB = 1 - probabilityA;

  // Display-only response fields. The logistic model above is unchanged.
  const surfaceEloColumn = surface === "All" ? null :
    (`elo_${surface.toLowerCase()}` as "elo_hard" | "elo_clay" | "elo_grass" | "elo_carpet");

  return {
    playerAStats: {
      effectiveElo: eloA,
      overallElo: a.elo_overall,
      surfaceElo: surfaceEloColumn ? a[surfaceEloColumn] : null,
      matchesPlayed: a.matches_played,
      headToHeadWins: aWins,
      servePointsWonPercent: serveA,
      returnPointsWonPercent: returnA,
    },
    playerBStats: {
      effectiveElo: eloB,
      overallElo: b.elo_overall,
      surfaceElo: surfaceEloColumn ? b[surfaceEloColumn] : null,
      matchesPlayed: b.matches_played,
      headToHeadWins: bWins,
      servePointsWonPercent: serveB,
      returnPointsWonPercent: returnB,
    },
    probabilityA,
    probabilityB,
    fairOddsA: 1 / probabilityA,
    fairOddsB: 1 / probabilityB,
    lowSample: a.matches_played < 10 || b.matches_played < 10,
    breakdown: {
      eloDifference,
      experienceDifference,
      headToHead,
      serveDifferencePP,
      returnDifferencePP,
      logit,
    },
  };
}
