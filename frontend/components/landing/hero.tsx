import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Sparkles, Zap, Shield, Search, Share2, PenTool, Database, Cloud, Lock, FileCode, FileImage } from "lucide-react";

export function Hero() {
  const itemCount = 15;

  return (
    <section className="relative overflow-hidden pt-32 pb-40 md:pt-48 md:pb-52 font-sans selection:bg-primary/10">

      {/* Background Effects */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary/10 opacity-30 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Orbital Ring Container */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] md:w-[900px] md:h-[900px] z-0 pointer-events-none flex items-center justify-center">

        {/* The Ring Border (Optional) */}
        <div className="absolute inset-0 rounded-full border border-primary/5 opacity-50" />

        {/* Rotating Container */}
        <div className="absolute inset-0 animate-[spin_120s_linear_infinite]">

          {[...Array(itemCount)].map((_, i) => {
            const angle = (i * 360) / itemCount;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-0 -ml-8 -mt-8 origin-[50%_300px] md:origin-[50%_450px]"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                {/* 
                  Inner Content:
                  Radial 'Clock-tick' orientation.
                  NO inner rotation/counter-rotation.
                  Card top points OUTWARDS from center? Or align with rotation?
                  'rotate(angle)' on parent rotates the whole frame.
                  So top of this div points away from center of orbit ring.
                */}
                <div
                  className="relative h-20 w-16 md:h-24 md:w-20 rounded-xl border-2 border-primary/10 bg-background shadow-xl flex items-center justify-center
                            transform transition-transform hover:scale-110"
                  style={{
                    // Add colored glow for some items
                    boxShadow: i % 5 === 0 ? '0 10px 40px -10px rgba(239,68,68,0.2)' : '0 10px 30px -10px rgba(0,0,0,0.1)'
                  }}
                >
                  {/* Icon variation */}
                  {i % 5 === 0 && <FileText className="h-8 w-8 text-red-500 fill-red-500/5" />}
                  {i % 5 === 1 && <Search className="h-8 w-8 text-blue-500" />}
                  {i % 5 === 2 && <Shield className="h-8 w-8 text-green-500" />}
                  {i % 5 === 3 && <Zap className="h-8 w-8 text-yellow-500" />}
                  {i % 5 === 4 && <Share2 className="h-8 w-8 text-purple-500" />}

                  {/* Mini "Lines" */}
                  <div className="absolute bottom-4 left-4 right-4 space-y-1.5 opacity-30">
                    <div className="h-1 w-full bg-foreground/50 rounded-full" />
                    <div className="h-1 w-2/3 bg-foreground/50 rounded-full" />
                  </div>

                  {/* Corner Fold */}
                  <div className="absolute top-0 right-0 h-6 w-6 bg-gradient-to-bl from-black/5 to-transparent rounded-bl-xl border-b border-l border-white/50" />
                </div>
              </div>
            );
          })}

        </div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center text-center">

          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-[0_0_20px_-5px_var(--color-primary)]">
            <Sparkles className="h-3 w-3" />
            <span className="relative">
              AI-Powered Document Intelligence
            </span>
          </div>

          {/* Headline - "Lebih tipis" (Light/Normal) & Red "PDF" */}
          <h1 className="mb-8 max-w-4xl text-4xl font-normal tracking-tight md:text-6xl lg:text-7xl animate-in fade-in slide-in-from-bottom-8 duration-700">
            Unlock the Power of
            <span className="block text-red-600 font-medium">
              PDFs
            </span>
          </h1>

          {/* Subtext */}
          <p className="mb-8 max-w-xl text-base text-muted-foreground md:text-lg leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-100">
            Turn static documents into dynamic knowledge.
            Upload, chat, and summarize instantly.
          </p>

          {/* Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-200">
            <Button size="lg" className="h-12 rounded-full px-8 text-base shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300 bg-primary text-primary-foreground border-0" asChild>
              <Link href="/register">
                Start Summarizing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 rounded-full px-8 backdrop-blur-sm bg-background/30 hover:bg-background/50 border-white/10" asChild>
              <Link href="#how-it-works">See Demo</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Blur / Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent z-20 pointer-events-none" />

      {/* Side Fades */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-20 pointer-events-none md:block hidden" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-20 pointer-events-none md:block hidden" />

    </section>
  );
}
