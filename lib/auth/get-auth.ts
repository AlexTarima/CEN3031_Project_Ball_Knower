import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getAuth = cache(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;

    // Same function your RLS policies use, so the UI and the database agree
    const { data: isAdmin } = await supabase.rpc("is_admin");

    return { claims: data.claims, isAdmin: isAdmin === true };
});

export async function requireUser() {
    const auth = await getAuth();
    if (!auth) redirect("/auth/login");
    return auth;
}

export async function requireAdmin() {
    const auth = await requireUser();
    if (!auth.isAdmin) redirect("/protected");
    return auth;
}