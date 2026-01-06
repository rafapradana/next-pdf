"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-4xl transition-all duration-300 ease-in-out font-sans",
          scrolled
            ? "bg-background/80 backdrop-blur-md border border-border/40 shadow-xl rounded-full py-2"
            : "bg-transparent py-3"
        )}
      >
        <div className="container mx-auto flex items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 group-hover:bg-red-100 transition-colors border border-red-100">
              <FileText className="h-5 w-5 text-red-600 transition-transform group-hover:scale-110 duration-300" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground transition-all duration-300">
              NEXT <span className="text-red-600">PDF</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {["Features", "Testimonials", "FAQ"].map((item) => (
              <Link
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hover:scale-105 duration-200"
              >
                {item}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Button variant="ghost" size="sm" className="rounded-full hover:bg-primary/5 hover:text-primary" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button size="sm" className="rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-105 transition-all duration-300" asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>

          <Button variant="ghost" size="icon" className="md:hidden rounded-full" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl pt-32 px-6 md:hidden animate-in slide-in-from-top-5 duration-300">
          <nav className="flex flex-col gap-6 text-center">
            {["Features", "How it Works", "FAQ"].map((item) => (
              <Link
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-2xl font-medium text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item}
              </Link>
            ))}
            <div className="flex flex-col gap-3 mt-8">
              <Button variant="outline" size="lg" className="rounded-full w-full py-6 text-lg" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="lg" className="rounded-full w-full py-6 text-lg shadow-xl shadow-primary/20" asChild>
                <Link href="/register">Get Started</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
