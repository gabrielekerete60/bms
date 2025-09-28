"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Home } from "lucide-react";

export function NotFoundClient() {
    const router = useRouter();

    const handleGoHome = () => {
        const loggedInUser = localStorage.getItem('loggedInUser');
        if (loggedInUser) {
            router.push('/dashboard');
        } else {
            router.push('/');
        }
    };

    return (
        <Button onClick={handleGoHome}>
            <Home className="mr-2 h-4 w-4" />
            Go Home
        </Button>
    );
}
