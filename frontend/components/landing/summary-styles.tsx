"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { List, AlignLeft, FileSearch, Briefcase, GraduationCap, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const styles = [
  {
    icon: List,
    id: "bullet_points",
    name: "Bullet Points",
    description: "Concise bullet-point format highlighting key information",
    example: "• Key finding 1\n• Key finding 2\n• Key finding 3",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    icon: AlignLeft,
    id: "paragraph",
    name: "Paragraph",
    description: "Flowing paragraph narrative for easy reading",
    example: "This document discusses... The main points include...",
    color: "bg-green-500/10 text-green-600",
  },
  {
    icon: FileSearch,
    id: "detailed",
    name: "Detailed Analysis",
    description: "Comprehensive detailed analysis with sections",
    example: "## Overview\n...\n## Key Findings\n...",
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    icon: Briefcase,
    id: "executive",
    name: "Executive Summary",
    description: "Brief executive summary with key takeaways",
    example: "**Bottom Line:** ...\n**Key Takeaways:**\n1. ...",
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    icon: GraduationCap,
    id: "academic",
    name: "Academic Style",
    description: "Academic/research style with structured sections",
    example: "**Abstract:** ...\n**Methods:** ...\n**Results:** ...",
    color: "bg-pink-500/10 text-pink-600",
  },
];

export function SummaryStyles() {
  return (
    <section className="py-24 bg-background">
      {/* Centered Container */}
      <div className="w-[90%] max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground mb-4"
          >
            <Sparkles className="h-3 w-3 text-primary" />
            Versatile Output
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight md:text-5xl mb-4"
          >
            5 Summary Styles
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Pick the format that works best for your needs. Add custom instructions for even more control.
          </motion.p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {styles.map((style, i) => (
            <motion.div
              key={style.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full border border-border/60 hover:border-primary/50 transition-colors bg-card/50 hover:bg-card hover:shadow-lg rounded-2xl overflow-hidden group">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 group-hover:bg-background border border-transparent group-hover:border-border transition-all ${style.color}`}>
                      <style.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">{style.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {style.description}
                  </p>
                  <div className="rounded-xl bg-muted/30 p-3 border border-border/30 group-hover:bg-muted/50 transition-colors">
                    <p className="font-mono text-[10px] text-muted-foreground whitespace-pre-line leading-relaxed">
                      {style.example}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            <Card className="h-full flex flex-col items-center justify-center border-dashed border-2 border-muted hover:border-primary/50 bg-muted/5 p-6 text-center rounded-2xl hover:bg-muted/10 transition-colors cursor-pointer group">
              <Badge variant="secondary" className="mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                Custom Instructions
              </Badge>
              <p className="text-sm text-muted-foreground/80 leading-relaxed max-w-[200px]">
                Type "Summarize in Indonesian" or "Focus on dates" for specific results.
              </p>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
