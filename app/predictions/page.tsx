"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { PlayerDisplayStats, Prediction, Surface } from "@/lib/model/predict";

type Player = { id: number; first_name: string; last_name: string };
type PredictionResponse = Prediction & {
  priorMeetings: number;
  playerAMatches: number;
  playerBMatches: number;
};

function fullName(player: Player) {
  return `${player.first_name} ${player.last_name}`.trim();
}

function PlayerPicker({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: Player | null;
  onSelect: (player: Player | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selected && query === fullName(selected)) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search unavailable");
        const data: { players: Player[] } = await response.json();
        if (!controller.signal.aborted) setResults(data.players);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, selected]);

  return (
    <div className="relative space-y-2">
      <label className="block text-sm font-semibold">{label}</label>
      <input
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black outline-none focus:border-blue-600"
        placeholder="Type a player's name (e.g. Alcaraz)"
        value={query}
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          onSelect(null);
        }}
      />
      {selected && <p className="text-sm text-green-600">Selected: {fullName(selected)}</p>}
      {loading && <p className="text-xs text-gray-500">Searching…</p>}
      {results.length > 0 && (
        <ul className="absolute z-20 max-h-60 w-full overflow-auto rounded-lg border bg-white shadow-lg">
          {results.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                className="block w-full px-4 py-3 text-left text-black hover:bg-blue-50"
                onClick={() => {
                  onSelect(player);
                  setQuery(fullName(player));
                  setResults([]);
                }}
              >
                {fullName(player)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-200 py-2.5 last:border-b-0">
      <span className="text-sm text-gray-600">{label}</span>
      <strong className="text-right text-sm tabular-nums text-gray-900">{value}</strong>
    </div>
  );
}

function PlayerStatsCard({
  player, stats, probability, fairOdds, surface, left,
}: {
  player: Player;
  stats: PlayerDisplayStats;
  probability: number;
  fairOdds: number;
  surface: Surface;
  left: boolean;
}) {
  const probabilityLabel = `${(probability * 100).toFixed(1)}%`;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white text-black shadow-sm">
      <div className={`p-5 ${left ? "bg-blue-50" : "bg-violet-50"}`}>
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {left ? "Player A" : "Player B"}
        </span>
        <h3 className="mt-1 text-xl font-bold">{fullName(player)}</h3>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-gray-600">Win probability</p>
            <p className={`text-4xl font-bold tabular-nums ${left ? "text-blue-700" : "text-violet-700"}`}>
              {probabilityLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">Fair decimal odds</p>
            <p className="text-xl font-bold tabular-nums">{fairOdds.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-200">
          <div className={`h-full ${left ? "bg-blue-600" : "bg-violet-600"}`} style={{ width: probabilityLabel }} />
        </div>
      </div>
      <div className="px-5 py-3">
        <StatRow label="Effective Elo" value={stats.effectiveElo.toFixed(1)} />
        <StatRow label="Overall Elo" value={stats.overallElo.toFixed(1)} />
        {surface !== "All" && stats.surfaceElo !== null && (
          <StatRow label={`${surface} Elo`} value={stats.surfaceElo.toFixed(1)} />
        )}
        <StatRow label="Historical matches" value={stats.matchesPlayed.toLocaleString()} />
        <StatRow label="Head-to-head wins" value={stats.headToHeadWins.toString()} />
        <StatRow label="Serve points won" value={`${stats.servePointsWonPercent.toFixed(1)}%`} />
        <StatRow label="Return points won" value={`${stats.returnPointsWonPercent.toFixed(1)}%`} />
      </div>
    </div>
  );
}

export default function PredictionsPage() {
  const [playerA, setPlayerA] = useState<Player | null>(null);
  const [playerB, setPlayerB] = useState<Player | null>(null);
  const [surface, setSurface] = useState<Surface>("Hard");
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!playerA || !playerB || playerA.id === playerB.id) {
      setError("Select two different players.");
      return;
    }
    setSubmitting(true);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerAId: playerA.id,
          playerBId: playerB.id,
          surface,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Prediction unavailable");
      setResult(payload as PredictionResponse);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Prediction unavailable");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-10">
      <nav className="text-sm"><Link href="/" className="text-blue-600 hover:underline">← Back to Ball Knowers</Link></nav>
      <div>
        <h1 className="text-3xl font-bold">Tennis Match Predictions</h1>
        <p className="mt-2 text-gray-500">Compare players using Elo, experience, head-to-head, and serve/return statistics.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <PlayerPicker label="Player A" selected={playerA} onSelect={(p) => { setPlayerA(p); setResult(null); }} />
          <PlayerPicker label="Player B" selected={playerB} onSelect={(p) => { setPlayerB(p); setResult(null); }} />
        </div>
        <div className="space-y-2">
          <label htmlFor="surface" className="block text-sm font-semibold">Surface</label>
          <select
            id="surface"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black"
            value={surface}
            onChange={(e) => { setSurface(e.target.value as Surface); setResult(null); }}
          >
            <option value="Hard">Hard</option>
            <option value="Clay">Clay</option>
            <option value="Grass">Grass</option>
            <option value="Carpet">Carpet</option>
            <option value="All">All surfaces</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={!playerA || !playerB || playerA.id === playerB.id || submitting}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Calculating…" : "Predict Match"}
        </button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>

      {result && playerA && playerB && (
        <section className="space-y-5" aria-live="polite">
          <div>
            <h2 className="text-2xl font-bold">Match prediction</h2>
            <p className="mt-1 text-sm text-gray-500">
              {surface === "All" ? "All surfaces" : `${surface} court`} · {result.priorMeetings} prior meeting{result.priorMeetings === 1 ? "" : "s"}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <PlayerStatsCard
              player={playerA}
              stats={result.playerAStats}
              probability={result.probabilityA}
              fairOdds={result.fairOddsA}
              surface={surface}
              left={true}
            />
            <PlayerStatsCard
              player={playerB}
              stats={result.playerBStats}
              probability={result.probabilityB}
              fairOdds={result.fairOddsB}
              surface={surface}
              left={false}
            />
          </div>
          <p className="text-xs text-gray-500">
            Effective Elo is 60% overall and 40% surface Elo. Serve and return percentages are smoothed model inputs.
            Fair odds are model-implied, not sportsbook prices.
          </p>
          {result.lowSample && (
            <p className="rounded-lg border border-amber-300 p-3 text-sm text-amber-700">
              Limited historical data: at least one player has fewer than 10 matches. Treat the forecast cautiously.
            </p>
          )}
        </section>
      )}

    </main>
  );
}
