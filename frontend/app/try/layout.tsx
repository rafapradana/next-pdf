import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TryLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex flex-col bg-neutral-50">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 group-hover:bg-red-100 transition-colors border border-red-100">
                            <FileText className="h-5 w-5 text-red-600 transition-transform group-hover:scale-110 duration-300" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">
                            NEXT <span className="text-red-600">PDF</span>
                        </span>
                    </Link>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        <Link href="/login">
                            <Button variant="ghost" size="sm">
                                Sign in
                            </Button>
                        </Link>
                        <Link href="/register">
                            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                                Get Started Free
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1">
                {children}
            </main>
        </div>
    );
}
