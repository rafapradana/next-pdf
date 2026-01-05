import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Sparkles, Zap, CheckCircle2, MoreHorizontal } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-12 md:pt-32 md:pb-20 bg-background">
      {/* Dynamic Grid Background */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* Spotlight Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/20 opacity-20 blur-[80px] rounded-[100%] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center text-center">

          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Sparkles className="h-3 w-3" />
            <span className="relative">
              AI-Powered Document Intelligence
              <span className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            </span>
          </div>

          {/* Huge Dynamic Headline */}
          <h1 className="mb-6 max-w-4xl text-4xl font-extrabold tracking-tight md:text-6xl lg:text-7xl animate-in fade-in slide-in-from-bottom-8 duration-700">
            Unlock the
            <span className="block bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent pb-2">
              Power of PDFs
            </span>
          </h1>

          {/* Subtext */}
          <p className="mb-8 max-w-xl text-base text-muted-foreground md:text-lg leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-100">
            Turn static documents into dynamic knowledge.
            Upload, chat, and summarize instantly.
          </p>

          {/* Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-200">
            <Button size="lg" className="h-10 rounded-full px-6 text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300" asChild>
              <Link href="/register">
                Start Summarizing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-10 rounded-full px-6 backdrop-blur-sm bg-background/50 hover:bg-background/80" asChild>
              <Link href="#how-it-works">See Demo</Link>
            </Button>
          </div>

          {/* Unusual Feature: Isometric Glass Stack */}
          <div className="mt-12 md:mt-20 relative w-full max-w-4xl mx-auto perspective-[2000px] group">

            {/* The Stage */}
            <div className="relative h-[320px] w-full transform-style-3d transition-transform duration-700 ease-out md:group-hover:rotate-x-2 md:group-hover:rotate-y-2">

              {/* Card 1: The Input (Bottom Layer) */}
              <div className="absolute left-1/2 top-0 w-[240px] md:w-[480px] -translate-x-1/2 rounded-2xl border bg-muted/40 p-4 shadow-2xl backdrop-blur-sm transform transform-style-3d 
                translate-z-[-50px] scale-95 opacity-60 transition-all duration-500 group-hover:translate-z-[-80px] group-hover:translate-y-4 group-hover:rotate-x-6">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500/50" />
                </div>
                <div className="space-y-2 opacity-30">
                  <div className="h-3 w-3/4 rounded bg-foreground/20" />
                  <div className="h-3 w-1/2 rounded bg-foreground/20" />
                  <div className="h-3 w-5/6 rounded bg-foreground/20" />
                </div>
              </div>

              {/* Card 2: The Processing (Middle Layer) */}
              <div className="absolute left-1/2 top-6 w-[240px] md:w-[480px] -translate-x-1/2 rounded-2xl border bg-background/60 p-4 shadow-2xl backdrop-blur-md transform transform-style-3d
                translate-z-[0px] transition-all duration-500 group-hover:translate-z-[-20px] group-hover:rotate-x-3 group-hover:translate-y-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                  <div className="flex gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-mono">research_paper.pdf</span>
                  </div>
                  <Zap className="h-4 w-4 text-yellow-500 animate-pulse" />
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full w-[70%] bg-primary/50" />
                    </div>
                    <div className="flex justify-between text-[8px] text-muted-foreground">
                      <span>Processing...</span>
                      <span>70%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-16 rounded overflow-hidden bg-muted/50 border border-white/5" />
                    <div className="h-16 rounded overflow-hidden bg-muted/50 border border-white/5" />
                  </div>
                </div>
              </div>

              {/* Card 3: The Result (Top/Hero Layer) */}
              <div className="absolute left-1/2 top-12 w-[240px] md:w-[480px] -translate-x-1/2 rounded-2xl border border-primary/20 bg-background p-5 shadow-2xl shadow-primary/10 transform transform-style-3d
                translate-z-[50px] transition-all duration-500 group-hover:translate-z-[100px] group-hover:-translate-y-4">

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold">AI Summary</h3>
                      <p className="text-[8px] text-muted-foreground">Generated in 2.4s</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </div>

                {/* Content */}
                <div className="space-y-3">
                  <div className="rounded-md bg-primary/5 p-3 border border-primary/10">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium text-foreground">Key Insight</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Transformer models enable parallelization, reducing training time significantly.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 pl-2 border-l-2 border-muted">
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      <span className="text-foreground font-medium">Conclusion:</span> 15% efficiency gain over LSTM.
                    </p>
                  </div>
                </div>

                {/* Floating Badge */}
                <div className="absolute -right-3 -top-3 rotate-12 bg-gradient-to-br from-primary to-purple-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                  New
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
