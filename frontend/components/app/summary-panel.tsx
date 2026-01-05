"use client";

import { useState, useEffect } from "react";
import { useFiles } from "@/lib/file-context";
import { FileItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Sparkles,
  Clock,
  History,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";

interface SummaryPanelProps {
  file: FileItem;
}

export function SummaryPanel({ file }: SummaryPanelProps) {
  const {
    currentSummary,
    summaryStyles,
    isLoadingSummary,
    loadSummary,
    loadSummaryStyles,
    generateSummary,
  } = useFiles();

  const [selectedStyle, setSelectedStyle] = useState("bullet_points");
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Load summary styles on mount
  useEffect(() => {
    loadSummaryStyles();
  }, [loadSummaryStyles]);

  // Load summary when file changes
  useEffect(() => {
    if (file.id) {
      loadSummary(file.id);
    }
  }, [file.id, loadSummary]);

  const handleGenerate = async () => {
    if (!file.id) return;

    setIsGenerating(true);
    const result = await generateSummary(
      file.id,
      selectedStyle,
      customInstructions || undefined
    );

    if (result.success) {
      toast.success("Summary generation started", {
        description: "This may take a few moments...",
      });
    } else {
      toast.error("Failed to generate summary", {
        description: result.error,
      });
    }
    setIsGenerating(false);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="summary" className="flex h-full flex-col">
        <div className="border-b px-4 py-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="summary" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {isLoadingSummary ? (
                <div className="space-y-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : currentSummary ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg leading-tight">
                      {currentSummary.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {summaryStyles.find((s) => s.id === currentSummary.style)
                          ?.name || currentSummary.style}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(currentSummary.processing_duration_ms)}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <History className="h-3 w-3" />v{currentSummary.version}
                      </Badge>
                    </div>
                  </div>

                  {currentSummary.custom_instructions && (
                    <div className="rounded-md bg-muted p-3 text-sm">
                      <p className="font-medium text-muted-foreground mb-1">
                        Custom Instructions:
                      </p>
                      <p>{currentSummary.custom_instructions}</p>
                    </div>
                  )}

                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: formatMarkdown(currentSummary.content),
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium">No Summary Yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Generate an AI summary to get insights from this document.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => {
                      const tab = document.querySelector(
                        '[data-state="inactive"][value="generate"]'
                      ) as HTMLElement;
                      tab?.click();
                    }}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Summary
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="generate" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="style">Summary Style</Label>
                <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                  <SelectTrigger id="style">
                    <SelectValue placeholder="Select a style" />
                  </SelectTrigger>
                  <SelectContent>
                    {summaryStyles.map((style) => (
                      <SelectItem key={style.id} value={style.id}>
                        <div className="flex flex-col">
                          <span>{style.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {summaryStyles.find((s) => s.id === selectedStyle) && (
                  <p className="text-xs text-muted-foreground">
                    {summaryStyles.find((s) => s.id === selectedStyle)?.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">
                  Custom Instructions{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="instructions"
                  placeholder="e.g., Focus on methodology and key findings. Summarize in Indonesian."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  maxLength={500}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {customInstructions.length}/500
                </p>
              </div>

              {file.status === "processing" && (
                <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>A summary is currently being generated...</span>
                </div>
              )}

              {file.status === "failed" && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>Previous summary generation failed. Try again.</span>
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleGenerate}
                disabled={isGenerating || file.status === "processing"}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Summary
                  </>
                )}
              </Button>

              {currentSummary && (
                <p className="text-xs text-muted-foreground text-center">
                  This will create a new version of the summary.
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Simple markdown formatter
function formatMarkdown(content: string): string {
  return content
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mt-4 mb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^• (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
}
