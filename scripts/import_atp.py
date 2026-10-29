
import csv
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client
from datetime import datetime


BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

load_dotenv(BASE_DIR / ".env")

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(url, key)


def clean(value):
    return (value or "").strip()


def import_players():
    players = {}

    for path in sorted(DATA_DIR.glob("*.csv")):
        print(f"Reading {path.name}")

        with path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)

            for row in reader:
                for prefix in ("winner", "loser"):
                    atp_id = clean(row.get(f"{prefix}_id"))
                    full_name = clean(row.get(f"{prefix}_name"))

                    if not atp_id or not full_name:
                        continue

                    # Match CSVs generally store names as
                    # "First Last". Preserve multiword last names
                    # as well as possible with this simple split.
                    parts = full_name.split(" ", 1)

                    first_name = parts[0]
                    last_name = (
                        parts[1] if len(parts) > 1 else parts[0]
                    )

                    players[atp_id] = {
                        "atp_id": atp_id,
                        "first_name": first_name,
                        "last_name": last_name,
                        "country": clean(
                            row.get(f"{prefix}_ioc")
                        ) or None,
                        "height_cm": (
                            int(row[f"{prefix}_ht"])
                            if clean(row.get(f"{prefix}_ht")).isdigit()
                            else None
                        ),
                        "handedness": clean(
                            row.get(f"{prefix}_hand")
                        ) or None,
                    }

    records = list(players.values())
    print(f"Found {len(records)} unique players")

    for i in range(0, len(records), 200):
        batch = records[i:i + 200]

        supabase.table("players").upsert(
            batch,
            on_conflict="atp_id"
        ).execute()

        print(
            f"Imported {min(i + 200, len(records))}"
            f"/{len(records)} players"
        )

def get_player_ids():
    """
    Retrieve all ATP IDs and their corresponding
    Supabase primary keys.

    Fetch in pages to avoid Supabase's default
    1,000-row API response limit.
    """
    player_ids = {}
    page_size = 1000
    offset = 0

    while True:
        response = (
            supabase.table("players")
            .select("id, atp_id")
            .order("id")
            .range(offset, offset + page_size - 1)
            .execute()
        )

        rows = response.data

        for player in rows:
            player_ids[str(player["atp_id"])] = player["id"]

        if len(rows) < page_size:
            break

        offset += page_size

    print(f"Loaded {len(player_ids)} player IDs")
    return player_ids


def parse_date(value):
    value = clean(value)

    if not value:
        return None

    try:
        return datetime.strptime(
            value, "%Y%m%d"
        ).strftime("%Y-%m-%d")
    except ValueError:
        return None

def import_matches():
    player_ids = get_player_ids()

    total_imported = 0
    total_skipped = 0
    batch_size = 200

    for path in sorted(DATA_DIR.glob("*.csv")):
        print(f"\nProcessing {path.name}")

        batch = {}
        file_imported = 0

        with path.open(
            encoding="utf-8-sig",
            newline=""
        ) as f:
            reader = csv.DictReader(f)

            for row in reader:
                winner_atp_id = clean(
                    row.get("winner_id")
                )
                loser_atp_id = clean(
                    row.get("loser_id")
                )

                winner_id = player_ids.get(
                    winner_atp_id
                )
                loser_id = player_ids.get(
                    loser_atp_id
                )

                tourney_id = clean(
                    row.get("tourney_id")
                )
                match_num = clean(
                    row.get("match_num")
                )

                match_date = parse_date(
                    row.get("tourney_date")
                )
                tournament = clean(
                    row.get("tourney_name")
                )

                # Skip rows with missing required data.
                if (
                    not winner_id
                    or not loser_id
                    or winner_id == loser_id
                    or not tourney_id
                    or not match_num
                    or not match_date
                    or not tournament
                ):
                    total_skipped += 1
                    continue

                # Identify matches consistently across runs.
                player_pair = sorted([winner_atp_id, loser_atp_id])

                source_match_id = (
                    f"{tourney_id}_{match_num}_"
                    f"{player_pair[0]}_{player_pair[1]}"
                )

                match = {
                    "source_match_id": source_match_id,
                    "tournament": tournament,
                    "match_date": match_date,
                    "surface": clean(
                        row.get("surface")
                    ) or None,
                    "round": clean(
                        row.get("round")
                    ) or None,
                    "winner_id": winner_id,
                    "loser_id": loser_id,
                    "score": clean(
                        row.get("score")
                    ) or None,
                }

                if source_match_id in batch:
                    previous = batch[source_match_id]

                    print(f"Duplicate ID: {source_match_id}")
                    print(
                        "Previous:",
                        previous["tournament"],
                        previous["winner_id"],
                        previous["loser_id"]
                    )
                    print(
                        "Current:",
                        match["tournament"],
                        match["winner_id"],
                        match["loser_id"]
                    )
                batch[source_match_id] = (match)

                if len(batch) >= batch_size:
                    supabase.table("matches").upsert(
                        list(batch.values()),
                        on_conflict="source_match_id"
                    ).execute()

                    file_imported += len(batch)
                    batch = {}

            # Import remaining matches.
            if batch:
                supabase.table("matches").upsert(
                    list(batch.values()),
                    on_conflict="source_match_id"
                ).execute()

                file_imported += len(batch)

        total_imported += file_imported

        print(
            f"Processed {file_imported} matches "
            f"from {path.name}"
        )

    print("\nImport complete!")
    print(f"Rows processed: {total_imported}")
    print(f"Skipped: {total_skipped}")


def optional_int(value):
    value = clean(value)
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def load_id_map(table, key_column):
    """Fetch every database ID, not just the first 1,000."""
    result = {}
    offset = 0
    page_size = 1000

    while True:
        rows = (
            supabase.table(table)
            .select(f"id, {key_column}")
            .order("id")
            .range(offset, offset + page_size - 1)
            .execute()
            .data
        )

        for row in rows:
            result[str(row[key_column])] = row["id"]

        if len(rows) < page_size:
            break

        offset += page_size

    return result


def import_match_stats():
    player_ids = load_id_map("players", "atp_id")
    match_ids = load_id_map("matches", "source_match_id")

    print(f"Loaded {len(player_ids)} players")
    print(f"Loaded {len(match_ids)} matches")

    stat_columns = {
        "ace": "aces",
        "df": "double_faults",
        "svpt": "service_points",
        "1stIn": "first_serves_in",
        "1stWon": "first_serve_points_won",
        "2ndWon": "second_serve_points_won",
        "SvGms": "service_games",
        "bpSaved": "break_points_saved",
        "bpFaced": "break_points_faced",
    }

    batch = []
    imported = 0
    skipped = 0
    batch_size = 200

    for path in sorted(DATA_DIR.glob("*.csv")):
        print(f"Processing statistics from {path.name}")

        with path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)

            for row in reader:
                winner_atp_id = clean(row.get("winner_id"))
                loser_atp_id = clean(row.get("loser_id"))

                pair = sorted([winner_atp_id, loser_atp_id])

                source_match_id = (
                    f"{clean(row.get('tourney_id'))}_"
                    f"{clean(row.get('match_num'))}_"
                    f"{pair[0]}_{pair[1]}"
                )

                match_id = match_ids.get(source_match_id)

                if match_id is None:
                    skipped += 1
                    continue

                for prefix, atp_id, won in (
                    ("w", winner_atp_id, True),
                    ("l", loser_atp_id, False),
                ):
                    player_id = player_ids.get(atp_id)

                    if player_id is None:
                        skipped += 1
                        continue

                    record = {
                        "match_id": match_id,
                        "player_id": player_id,
                        "is_winner": won,
                    }

                    for csv_col, db_col in stat_columns.items():
                        record[db_col] = optional_int(
                            row.get(f"{prefix}_{csv_col}")
                        )

                    if (
                            record["service_points"] is not None
                            and record["first_serves_in"] is not None
                            and record["first_serves_in"] > record["service_points"]
                    ):
                        record["service_points"] = None
                        record["first_serves_in"] = None
                        record["first_serve_points_won"] = None
                        record["second_serve_points_won"] = None

                    if (
                            record["break_points_saved"] is not None
                            and record["break_points_faced"] is not None
                            and record["break_points_saved"] > record["break_points_faced"]
                    ):
                        record["break_points_saved"] = None
                        record["break_points_faced"] = None

                    batch.append(record)

                    if len(batch) >= batch_size:
                        supabase.table(
                            "match_player_stats"
                        ).upsert(
                            batch,
                            on_conflict="match_id,player_id"
                        ).execute()

                        imported += len(batch)
                        batch = []

    if batch:
        supabase.table("match_player_stats").upsert(
            batch,
            on_conflict="match_id,player_id"
        ).execute()
        imported += len(batch)

    print(f"Imported {imported} player-match stat rows")
    print(f"Skipped {skipped} records")


if __name__ == "__main__":
    print("=== Importing players ===")
    import_players()

    print("\n=== Importing matches ===")
    import_matches()

    print("\n=== Importing match statistics ===")
    import_match_stats()

    print("\n=== Updating aggregated statistics ===")
    supabase.rpc("refresh_player_stats").execute()

    print("\n=== Resolving predictions ===")
    supabase.rpc("resolve_predictions").execute()

    print("\n=== Import complete ===")