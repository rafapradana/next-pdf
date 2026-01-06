"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, FileText, Zap, ShieldCheck } from "lucide-react";

export function CTA() {
  return (
    <section className="py-24 px-6 md:px-0">
      <div className="w-full max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative bg-white rounded-[2rem] border border-neutral-200 p-8 md:p-12 overflow-hidden shadow-2xl shadow-neutral-200/50"
        >
          {/* Background Grid - Red Tint */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ef44440a_1px,transparent_1px),linear-gradient(to_bottom,#ef44440a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

          {/* Subtle Red/Orange Glow - Warm tones */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-red-500/5 rounded-full blur-[100px]" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-orange-500/5 rounded-full blur-[80px]" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">

            {/* Content Side */}
            <div className="flex-1 text-center md:text-left space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold uppercase tracking-wider border border-red-100">
                <Zap className="h-3 w-3 fill-red-600" />
                Ready to start?
              </div>

              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-950 leading-tight">
                Stop skimming. <br className="hidden md:block" />
                Start <span className="text-red-600">understanding.</span>
              </h2>

              <p className="text-base text-muted-foreground max-w-sm mx-auto md:mx-0 leading-relaxed">
                Join thousands of students and professionals using NextPDF to unlock the knowledge inside their documents.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 justify-center md:justify-start">
                <Button size="lg" className="rounded-full px-8 h-12 text-sm font-semibold bg-neutral-900 hover:bg-neutral-800 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all w-full sm:w-auto" asChild>
                  <Link href="/register">
                    Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground flex items-center justify-center md:justify-start gap-1.5 opacity-70">
                <ShieldCheck className="h-3 w-3 text-red-500" /> Secure • No credit card required
              </p>
            </div>

            {/* Visual Side - Compact Red Themed */}
            <div className="relative w-full max-w-[280px] aspect-[4/3] flex items-center justify-center">

              {/* Main Card */}
              <motion.div
                className="bg-white p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-100 relative z-20 w-full max-w-[220px]"
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 bg-red-50 rounded-lg flex items-center justify-center border border-red-100">
                    <FileText className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <div className="h-2 w-20 bg-neutral-100 rounded-full mb-1.5" />
                    <div className="h-2 w-12 bg-neutral-100 rounded-full" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-1.5 w-full bg-neutral-50 rounded-full" />
                  <div className="h-1.5 w-[90%] bg-neutral-50 rounded-full" />
                  <div className="h-1.5 w-[80%] bg-neutral-50 rounded-full" />
                </div>

                {/* Floating Action Button simulation */}
                <div className="absolute -right-3 -bottom-3 bg-red-600 text-white p-2.5 rounded-full shadow-lg shadow-red-200">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </motion.div>

              {/* Background elements */}
              <motion.div
                className="absolute top-4 right-4 w-12 h-12 bg-orange-50 rounded-lg border border-orange-100 -z-10"
                animate={{ rotate: 12, y: -10 }}
                transition={{ duration: 4, repeat: Infinity, repeatType: "mirror" }}
              />
              <motion.div
                className="absolute bottom-4 left-4 w-16 h-16 bg-neutral-50 rounded-full border border-neutral-100 -z-10"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />

            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
}
