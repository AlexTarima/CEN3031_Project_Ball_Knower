import csv
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
load_dotenv(BASE_DIR / ".env")

K = 32.0
INITIAL_ELO = 1500.0
SURFACES = {"Hard", "Clay", "Grass"}
ROUND_ORDER = {
    "Q1": -3, "Q2": -2, "Q3": -1, "RR": 0, "R128": 1,
    "R64": 2, "R32": 3, "R16": 4, "QF": 5, "SF": 6, "F": 7,
}


def clean(value):
    return (value or "").strip()


def parse_int(value):
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def serve_counts(row, prefix):
    total = parse_int(row.get(f"{prefix}_svpt"))
    first_in = parse_int(row.get(f"{prefix}_1stIn"))
    first_won = parse_int(row.get(f"{prefix}_1stWon"))
    second_won = parse_int(row.get(f"{prefix}_2ndWon"))
    if None in (total, first_in, first_won, second_won):
        return None
    if not (0 <= first_won <= first_in <= total):
        return None
    if not (0 <= second_won <= total - first_in):
        return None
    return first_won + second_won, total


def elo_expected(a, b):
    return 1.0 / (1.0 + 10.0 ** ((b - a) / 400.0))


def update_pair(rating_a, rating_b):
    delta = K * (1.0 - elo_expected(rating_a, rating_b))
    return rating_a + delta, rating_b - delta


def load_matches():
    unique = {}
    for path in sorted(DATA_DIR.glob("*.csv")):
        with path.open(encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                a, b = clean(row.get("winner_id")), clean(row.get("loser_id"))
                date_value = clean(row.get("tourney_date"))
                if not a or not b or a == b or not date_value:
                    continue
                if not clean(row.get("tourney_id")) or not clean(row.get("match_num")):
                    continue
                try:
                    date = datetime.strptime(date_value, "%Y%m%d")
                except ValueError:
                    continue
                pair = sorted([a, b])
                match_key = (
                    f"{clean(row.get('tourney_id'))}_"
                    f"{clean(row.get('match_num'))}_{pair[0]}_{pair[1]}"
                )
                unique[match_key] = (date, row)

    return sorted(
        unique.values(),
        key=lambda item: (
            item[0],
            clean(item[1].get("tourney_id")),
            ROUND_ORDER.get(clean(item[1].get("round")), 0),
            parse_int(item[1].get("match_num")) or 0,
        ),
    )


def get_player_id_map(supabase):
    result = {}
    offset = 0
    while True:
        rows = (
            supabase.table("players")
            .select("id,atp_id")
            .order("id")
            .range(offset, offset + 999)
            .execute()
            .data
        )
        for row in rows:
            result[str(row["atp_id"])] = int(row["id"])
        if len(rows) < 1000:
            break
        offset += 1000
    return result


def fresh_state():
    return {
        "elo_overall": INITIAL_ELO,
        "elo_hard": INITIAL_ELO,
        "elo_clay": INITIAL_ELO,
        "elo_grass": INITIAL_ELO,
        "matches_played": 0,
        "serve_points_won": 0,
        "serve_points_total": 0,
        "return_points_won": 0,
        "return_points_total": 0,
    }


def build_states(matches, id_map):
    states = defaultdict(fresh_state)
    h2h = defaultdict(lambda: [0, 0])
    used = 0

    for _, row in matches:
        winner = id_map.get(clean(row.get("winner_id")))
        loser = id_map.get(clean(row.get("loser_id")))
        if winner is None or loser is None or winner == loser:
            continue
        w = states[winner]
        l = states[loser]
        w["elo_overall"], l["elo_overall"] = update_pair(
            w["elo_overall"], l["elo_overall"]
        )
        surface = clean(row.get("surface"))
        if surface in SURFACES:
            key = "elo_" + surface.lower()
            w[key], l[key] = update_pair(w[key], l[key])

        w["matches_played"] += 1
        l["matches_played"] += 1

        pair = (min(winner, loser), max(winner, loser))
        h2h[pair][0 if winner == pair[0] else 1] += 1

        w_serve = serve_counts(row, "w")
        l_serve = serve_counts(row, "l")
        if w_serve is not None:
            won, total = w_serve
            w["serve_points_won"] += won
            w["serve_points_total"] += total
            l["return_points_won"] += total - won
            l["return_points_total"] += total
        if l_serve is not None:
            won, total = l_serve
            l["serve_points_won"] += won
            l["serve_points_total"] += total
            w["return_points_won"] += total - won
            w["return_points_total"] += total
        used += 1

    return states, h2h, used


def upsert_batched(supabase, table, records):
    for start in range(0, len(records), 200):
        supabase.table(table).upsert(records[start:start + 200]).execute()


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in scripts/.env")
    if not list(DATA_DIR.glob("*.csv")):
        raise SystemExit(f"No ATP CSVs found in {DATA_DIR}")

    supabase = create_client(url, key)
    id_map = get_player_id_map(supabase)
    matches = load_matches()
    states, h2h, used = build_states(matches, id_map)

    # Include players with zero historical matches as neutral 1500-rated players.
    built_at = datetime.now(timezone.utc).isoformat()
    features = [
        {"player_id": pid, **states[pid], "updated_at": built_at}
        for pid in sorted(id_map.values())
    ]
    h2h_records = [
        {
            "player1_id": a, "player2_id": b,
            "player1_wins": counts[0], "player2_wins": counts[1],
            "updated_at": built_at,
        }
        for (a, b), counts in sorted(h2h.items())
    ]
    upsert_batched(supabase, "player_model_features", features)
    upsert_batched(supabase, "model_head_to_head", h2h_records)
    print(f"Processed {used} matches; updated {len(features)} player ratings "
          f"and {len(h2h_records)} head-to-head pairs.")
    print("Note: dates represent tournament start; within-tournament order is approximate.")


if __name__ == "__main__":
    main()
