import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/get-auth";

async function AdminContent() {
    await requireAdmin(); // still redirects non-admins

    return (
        <div className="flex flex-col gap-4">
            <h1 className="font-bold text-2xl">Admin</h1>
            <p>Only admins can see this.</p>
        </div>
    );
}

export default function AdminPage() {
    return (
        <Suspense
            fallback={<p className="text-sm text-muted-foreground">Checking access…</p>}
        >
            <AdminContent />
        </Suspense>
    );
}