import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

function formatTime(seconds?: number) {
    if (!seconds) return "—";
    return new Date(seconds * 1000).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data?.claims) {
        redirect("/auth/login");
    }

    const claims = data.claims;
    const provider = (claims.app_metadata as { provider?: string } | undefined)
        ?.provider;

    const rows: { label: string; value: React.ReactNode }[] = [
        { label: "Email", value: claims.email ?? "—" },
        {
            label: "User ID",
            value: <span className="font-mono text-xs break-all">{claims.sub}</span>,
        },
        { label: "Role", value: <Badge variant="secondary">{claims.role}</Badge> },
        { label: "Sign-in method", value: provider ?? "—" },
        { label: "Signed in", value: formatTime(claims.iat) },
        { label: "Session expires", value: formatTime(claims.exp) },
    ];

    return (
        <div className="flex-1 w-full flex flex-col gap-8">
            <div>
                <h1 className="font-bold text-3xl">Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                    Welcome back{claims.email ? `, ${claims.email}` : ""}.
                </p>
            </div>

            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle>Account</CardTitle>
                    <CardDescription>Your current account and session details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <dl className="divide-y">
                        {rows.map(({ label, value }) => (
                            <div
                                key={label}
                                className="flex items-start justify-between gap-6 py-3 text-sm"
                            >
                                <dt className="text-muted-foreground shrink-0">{label}</dt>
                                <dd className="text-right">{value}</dd>
                            </div>
                        ))}
                    </dl>
                </CardContent>
            </Card>
        </div>
    );
}