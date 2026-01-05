import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { List, AlignLeft, FileSearch, Briefcase, GraduationCap } from "lucide-react";

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
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            5 Summary Styles to Choose From
          </h2>
          <p className="text-lg text-muted-foreground">
            Pick the format that works best for your needs. Add custom instructions for even more control.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {styles.map((style) => (
            <Card key={style.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${style.color}`}>
                    <style.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{style.name}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <CardDescription>{style.description}</CardDescription>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="font-mono text-xs text-muted-foreground whitespace-pre-line">
                    {style.example}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Card className="flex flex-col items-center justify-center border-dashed bg-muted/20 p-6 text-center">
            <Badge variant="secondary" className="mb-3">Custom Instructions</Badge>
            <p className="text-sm text-muted-foreground">
              Add your own instructions like &quot;Focus on methodology&quot; or &quot;Summarize in Indonesian&quot; for personalized results.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}
