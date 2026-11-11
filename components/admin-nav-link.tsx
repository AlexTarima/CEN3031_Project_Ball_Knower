import Link from "next/link";
import { getAuth } from "@/lib/auth/get-auth";

export async function AdminNavLink() {
    const auth = await getAuth();
    if (!auth?.isAdmin) return null;

    return <Link href="/protected/admin">Admin</Link>;
}