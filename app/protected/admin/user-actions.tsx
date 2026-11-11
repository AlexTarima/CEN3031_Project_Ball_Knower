"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteUserAction, sendPasswordResetAction } from "./actions";

export function UserActions({
                                userId,
                                email,
                                isSelf,
                            }: {
    userId: string;
    email: string;
    isSelf: boolean;
}) {
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);

    function run(fn: () => Promise<{ message: string }>) {
        startTransition(async () => {
            const result = await fn();
            setMessage(result.message);
        });
    }

    return (
        <div className="flex flex-col gap-1 items-start">
        <div className="flex gap-2">
        <Button
            size="sm"
    variant="outline"
    disabled={pending || !email}
    onClick={() => {
        if (confirm(`Send a password reset email to ${email}?`)) {
            run(() => sendPasswordResetAction(email));
        }
    }}
>
    Reset password
    </Button>
    <Button
    size="sm"
    variant="destructive"
    disabled={pending || isSelf}
    onClick={() => {
        if (confirm(`Permanently delete ${email || userId}? This can't be undone.`)) {
            run(() => deleteUserAction(userId));
        }
    }}
>
    Delete
    </Button>
    </div>
    {message && <span className="text-xs text-muted-foreground">{message}</span>}
        </div>
    );
    }