import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTA() {
  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center md:px-12 md:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-foreground/10 via-transparent to-transparent" />
          
          <div className="relative">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-1.5 text-sm text-primary-foreground">
              <Sparkles className="h-4 w-4" />
              <span>Start Understanding Your PDFs Today</span>
            </div>
            
            <h2 className="mb-4 text-3xl font-bold text-primary-foreground md:text-5xl">
              Ready to Transform How You
              <br />
              Work with Documents?
            </h2>
            
            <p className="mx-auto mb-8 max-w-xl text-lg text-primary-foreground/80">
              Join thousands of students, researchers, and professionals who save hours every week with AI-powered PDF summaries.
            </p>
            
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" variant="secondary" asChild className="gap-2">
                <Link href="/register">
                  Get Started for Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="ghost" asChild className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
