import { Suspense } from "react";
import type { User } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/get-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserActions } from "./user-actions";

const PER_PAGE = 1000;

async function fetchAllUsers(): Promise<User[]> {
    const admin = createAdminClient();
    const users: User[] = [];
    for (let page = 1; ; page++) {
        const { data, error } = await admin.auth.admin.listUsers({
            page,
            perPage: PER_PAGE,
        });
        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < PER_PAGE) break;
    }
    return users;
}

function providerType(provider: string) {
    if (provider === "email") return "Email";
    if (provider === "phone") return "Phone";
    if (provider.startsWith("sso:")) return "SSO";
    return "OAuth";
}

function formatDate(value?: string | null) {
    if (!value) return "Never";
    return new Date(value).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
    });
}

async function AdminContent({
                                searchParams,
                            }: {
    searchParams: Promise<{ q?: string }>;
}) {
    const auth = await requireAdmin();
    const { q = "" } = await searchParams;
    const query = q.trim().toLowerCase();

    const all = await fetchAllUsers();
    const users = all
        .filter((u) => !query || (u.email ?? "").toLowerCase().includes(query))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

    return (
        <div className="flex flex-col gap-4 w-full">
            <h1 className="font-bold text-2xl">Users</h1>

            <form className="flex gap-2 max-w-md">
                <Input
                    name="q"
                    type="search"
                    placeholder="Search by email"
                    defaultValue={q}
                />
                <Button type="submit">Search</Button>
            </form>

            <p className="text-sm text-muted-foreground">
                {users.length} of {all.length} users (dates in UTC)
            </p>

            <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm text-left">
                    <thead className="border-b bg-accent">
                    <tr>
                        {[
                            "UID",
                            "Display name",
                            "Email",
                            "Phone",
                            "Providers",
                            "Provider type",
                            "Created at",
                            "Last sign in at",
                            "Actions",
                        ].map((h) => (
                            <th key={h} className="p-3 font-medium whitespace-nowrap">
                                {h}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {users.map((u) => {
                        const providers: string[] = u.app_metadata?.providers ?? [];
                        const name =
                            u.user_metadata?.display_name ??
                            u.user_metadata?.full_name ??
                            u.user_metadata?.name ??
                            "—";

                        return (
                            <tr key={u.id} className="border-b last:border-b-0 align-top">
                                <td className="p-3 font-mono text-xs">{u.id}</td>
                                <td className="p-3">{name}</td>
                                <td className="p-3">{u.email ?? "—"}</td>
                                <td className="p-3">{u.phone || "—"}</td>
                                <td className="p-3">{providers.join(", ") || "—"}</td>
                                <td className="p-3">
                                    {[...new Set(providers.map(providerType))].join(", ") || "—"}
                                </td>
                                <td className="p-3 whitespace-nowrap">{formatDate(u.created_at)}</td>
                                <td className="p-3 whitespace-nowrap">{formatDate(u.last_sign_in_at)}</td>
                                <td className="p-3">
                                    <UserActions
                                        userId={u.id}
                                        email={u.email ?? ""}
                                        isSelf={u.id === auth.claims.sub}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                    {users.length === 0 && (
                        <tr>
                            <td colSpan={9} className="p-6 text-center text-muted-foreground">
                                No users found.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function AdminPage({
                                      searchParams,
                                  }: {
    searchParams: Promise<{ q?: string }>;
}) {
    return (
        <Suspense
            fallback={<p className="text-sm text-muted-foreground">Checking access…</p>}
        >
            <AdminContent searchParams={searchParams} />
        </Suspense>
    );
}