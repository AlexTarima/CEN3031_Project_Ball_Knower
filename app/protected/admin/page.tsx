import { requireAdmin } from "@/lib/auth/get-auth";

export default async function AdminPage() {
    await requireAdmin(); // check in the page itself, not just a layout

    return (
        <div className="flex flex-col gap-4">
            <h1 className="font-bold text-2xl">Admin</h1>
            <p>Only admins can see this.</p>
        </div>
    );
}