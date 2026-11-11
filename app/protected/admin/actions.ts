"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/get-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: boolean; message: string };

export async function deleteUserAction(userId: string): Promise<Result> {
    const auth = await requireAdmin();

    if (auth.claims.sub === userId) {
        return { ok: false, message: "You can't delete your own account." };
    }

    const { error } = await createAdminClient().auth.admin.deleteUser(userId);
    if (error) return { ok: false, message: error.message };

    revalidatePath("/protected/admin");
    return { ok: true, message: "User deleted." };
}

export async function sendPasswordResetAction(email: string): Promise<Result> {
    await requireAdmin();

    if (!email) return { ok: false, message: "This user has no email address." };

    const origin =
        (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

    const { error } = await createAdminClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/update-password`,
    });
    if (error) return { ok: false, message: error.message };

    return { ok: true, message: `Reset email sent to ${email}.` };
}