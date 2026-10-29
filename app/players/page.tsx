import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ first_name?: string; last_name?: string }>;

async function SearchResults({
                                 firstName,
                                 lastName,
                             }: {
    firstName: string;
    lastName: string;
}) {
    const supabase = await createClient();

    const { data: players, error } = await supabase.rpc("search_players", {
        p_first_name: firstName,
        p_last_name: lastName,
    });

    if (error) {
        return <p>Error searching players: {error.message}</p>;
    }

    if (!players || players.length === 0) {
        return <p>No players found.</p>;
    }

    return (
        <table className="w-full max-w-2xl text-left text-sm border-collapse">
            <thead>
            <tr>
                <th className="border-b p-2 font-semibold">Rank</th>
                <th className="border-b p-2 font-semibold">First Name</th>
                <th className="border-b p-2 font-semibold">Last Name</th>
            </tr>
            </thead>
            <tbody>
            {players.map(
                (player: {
                    id: number;
                    first_name: string;
                    last_name: string;
                    current_rank: number | null;
                }) => (
                    <tr key={player.id}>
                        <td className="border-b border-foreground/10 p-2">
                            {player.current_rank ?? "-"}
                        </td>
                        <td className="border-b border-foreground/10 p-2">{player.first_name}</td>
                        <td className="border-b border-foreground/10 p-2">{player.last_name}</td>
                    </tr>
                )
            )}
            </tbody>
        </table>
    );
}

// Reads searchParams, so it must live under a Suspense boundary
async function SearchContent({ searchParams }: { searchParams: SearchParams }) {
    const { first_name = "", last_name = "" } = await searchParams;
    const firstName = first_name.trim();
    const lastName = last_name.trim();
    const hasSearch = firstName !== "" || lastName !== "";

    return (
        <>
            <form method="get" className="flex gap-3 mb-8 max-w-2xl">
                <input
                    name="first_name"
                    defaultValue={firstName}
                    placeholder="First name"
                    className="flex-1 rounded border p-2 bg-transparent"
                />
                <input
                    name="last_name"
                    defaultValue={lastName}
                    placeholder="Last name"
                    className="flex-1 rounded border p-2 bg-transparent"
                />
                <button type="submit" className="rounded border px-4 py-2 font-medium">
                    Search
                </button>
            </form>

            {hasSearch ? (
                <Suspense key={`${firstName}|${lastName}`} fallback={<p>Searching...</p>}>
                    <SearchResults firstName={firstName} lastName={lastName} />
                </Suspense>
            ) : (
                <p>Enter a first and/or last name to search.</p>
            )}
        </>
    );
}

export default function PlayersPage({
                                        searchParams,
                                    }: {
    searchParams: SearchParams;
}) {
    return (
        <main className="min-h-screen p-8">
            <h1 className="text-3xl font-bold mb-6">Player Search</h1>

            <Suspense fallback={<p>Loading...</p>}>
                <SearchContent searchParams={searchParams} />
            </Suspense>
        </main>
    );
}