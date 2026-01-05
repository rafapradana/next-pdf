import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Sparkles, FolderTree } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>AI-Powered Document Intelligence</span>
          </div>
          
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            Understand Your PDFs
            <span className="block text-primary">In Seconds</span>
          </h1>
          
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Upload, organize, and get AI-powered summaries of your PDF documents. 
            Stop wasting time scanning through pages — let AI do the heavy lifting.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild className="gap-2">
              <Link href="/register">
                Start for Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#how-it-works">See How It Works</Link>
            </Button>
          </div>
          
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <span>PDF Support</span>
            </div>
            <div className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              <span>Drag & Drop Organization</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <span>5 Summary Styles</span>
            </div>
          </div>
        </div>

        <div className="mt-16 md:mt-24">
          <div className="relative mx-auto max-w-5xl">
            <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-xl border bg-card shadow-2xl">
              <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="ml-2 text-sm text-muted-foreground">NEXT PDF</span>
              </div>
              <div className="grid grid-cols-12 divide-x">
                <div className="col-span-3 bg-muted/30 p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1.5 text-sm">
                      <FolderTree className="h-4 w-4" />
                      <span>Research Papers</span>
                    </div>
                    <div className="ml-4 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 px-2 py-1">
                        <FileText className="h-3 w-3" />
                        <span>AI_Research.pdf</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-md bg-accent px-2 py-1">
                        <FileText className="h-3 w-3" />
                        <span>ML_Paper.pdf</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                      <FolderTree className="h-4 w-4" />
                      <span>Work Documents</span>
                    </div>
                  </div>
                </div>
                <div className="col-span-5 p-4">
                  <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed bg-muted/20">
                    <div className="text-center text-muted-foreground">
                      <FileText className="mx-auto h-12 w-12 mb-2" />
                      <p className="text-sm">PDF Viewer</p>
                    </div>
                  </div>
                </div>
                <div className="col-span-4 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">AI Summary</h4>
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600">Ready</span>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>• Key findings on transformer models</p>
                      <p>• Analysis of BERT and GPT variants</p>
                      <p>• Best practices for fine-tuning</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Generated in 12.5s
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
