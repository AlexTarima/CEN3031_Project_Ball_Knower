import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

async function PlayersTable() {
    const supabase = await createClient();

    const { data: players, error } = await supabase
        .from("players")
        .select("id, first_name, last_name, current_rank")
        .order("current_rank", { ascending: true, nullsFirst: false })
        .limit(100);

    if (error) {
        return <p>Error loading players: {error.message}</p>;
    }

    if (!players || players.length === 0) {
        return (
            <p>
                No rows returned. The table may be empty, or Row Level Security may be
                blocking reads.
            </p>
        );
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
            {players.map((player) => (
                <tr key={player.id}>
                    <td className="border-b border-foreground/10 p-2">
                        {player.current_rank ?? "-"}
                    </td>
                    <td className="border-b border-foreground/10 p-2">
                        {player.first_name}
                    </td>
                    <td className="border-b border-foreground/10 p-2">
                        {player.last_name}
                    </td>
                </tr>
            ))}
            </tbody>
        </table>
    );
}

export default function PlayersPage() {
    return (
        <main className="min-h-screen p-8">
            <h1 className="text-3xl font-bold mb-6">Player Search</h1>

            <Suspense fallback={<p>Loading players...</p>}>
                <PlayersTable />
            </Suspense>
        </main>
    );
}