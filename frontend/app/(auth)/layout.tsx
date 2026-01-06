"use client";

import Link from "next/link";
import { ChevronLeft, FileText, Search, Shield, Zap, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const itemCount = 12; // Slightly fewer items for the side panel

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2">

      {/* LEFT PANEL - Visual & Brand */}
      <div className="hidden lg:flex relative flex-col justify-between overflow-hidden bg-neutral-50 px-12 py-12 border-r border-neutral-100">

        {/* Background Effects */}
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#ef444408_1px,transparent_1px),linear-gradient(to_bottom,#ef444408_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Floating Home Link */}
        <div className="relative z-20">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-red-600 transition-colors"
          >
            <div className="p-1 rounded-md bg-white border border-neutral-200 shadow-sm">
              <ChevronLeft className="h-4 w-4" />
            </div>
            Back to Home
          </Link>
        </div>

        {/* Orbital Visual (Centered) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none flex items-center justify-center opacity-80 scale-90">
          {/* Rotating Container */}
          <div className="absolute inset-0 animate-[spin_60s_linear_infinite]">
            {[...Array(itemCount)].map((_, i) => {
              const angle = (i * 360) / itemCount;
              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-0 -ml-6 -mt-6 origin-[50%_300px]"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  {/* Counter-rotate content to keep it upright, or let it spin? Hero spins. Let's spin. */}
                  <div
                    className="relative h-16 w-14 rounded-xl border border-red-500/10 bg-white shadow-lg flex items-center justify-center transform transition-transform"
                    style={{
                      boxShadow: i % 4 === 0 ? '0 10px 40px -10px rgba(239,68,68,0.2)' : '0 10px 20px -5px rgba(0,0,0,0.05)'
                    }}
                  >
                    {i % 5 === 0 && <FileText className="h-6 w-6 text-red-500" />}
                    {i % 5 === 1 && <Search className="h-6 w-6 text-neutral-400" />}
                    {i % 5 === 2 && <Shield className="h-6 w-6 text-neutral-400" />}
                    {i % 5 === 3 && <Zap className="h-6 w-6 text-orange-400" />}
                    {i % 5 === 4 && <Share2 className="h-6 w-6 text-neutral-400" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center Logo/Icon */}
          <div className="relative z-10 bg-white p-6 rounded-3xl shadow-2xl border border-red-100 flex flex-col items-center gap-3">
            <div className="h-14 w-14 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div className="text-center">
              <div className="font-bold text-neutral-900 text-lg">NextPDF</div>
              <div className="text-xs text-neutral-500">AI Intelligent Platform</div>
            </div>
          </div>
        </div>

        {/* Bottom Text */}
        <div className="relative z-20 max-w-md">
          <blockquote className="text-xl font-medium text-neutral-900 leading-relaxed mb-4">
            &ldquo;Stop skimming. Start understanding. The fastest way to extract knowledge from your documents.&rdquo;
          </blockquote>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <div className="flex -space-x-3">
              {[
                "https://randomuser.me/api/portraits/thumb/men/32.jpg",
                "https://randomuser.me/api/portraits/thumb/women/44.jpg",
                "https://randomuser.me/api/portraits/thumb/men/86.jpg",
                "https://randomuser.me/api/portraits/thumb/women/68.jpg"
              ].map((src, i) => (
                <Avatar key={i} className="border-2 border-white size-8">
                  <AvatarImage src={src} alt="User" />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span>Join 10,000+ users</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-white relative">
        <div className="lg:hidden absolute top-6 left-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500">
            <ChevronLeft className="h-4 w-4" /> Home
          </Link>
        </div>

        <div className="w-full max-w-sm space-y-6">
          {children}
        </div>
      </div>

    </div>
  );
}
