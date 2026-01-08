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
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Clock,
  History,
  Loader2,
  AlertCircle,
  FileText,
  Languages,
  Check,
  Terminal,
  RefreshCw,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SummaryPanelProps {
  file: FileItem;
}

const LANGUAGES = [
  { id: "en", name: "English", flag: "🇺🇸" },
  { id: "id", name: "Indonesia", flag: "🇮🇩" },
];

export function SummaryPanel({ file }: SummaryPanelProps) {
  const {
    currentSummary,
    summaryHistory,
    summaryStyles,
    isLoadingSummary,
    isLoadingHistory,
    loadSummary,
    loadSummaryHistory,
    loadSummaryStyles,
  } = useFiles();

  const [selectedStyle, setSelectedStyle] = useState("bullet_points");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [customInstructions, setCustomInstructions] = useState("");

  // Streaming State
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [streamingError, setStreamingError] = useState<string | null>(null);

  // Modal State
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);

  // Load summary styles on mount
  useEffect(() => {
    loadSummaryStyles();
  }, [loadSummaryStyles]);

  // Load summary and history when file changes
  useEffect(() => {
    if (file.id) {
      loadSummary(file.id);
      loadSummaryHistory(file.id);
      // Reset streaming state on file change
      setIsStreaming(false);
      setStreamLogs([]);
      setStreamingError(null);
    }
  }, [file.id, loadSummary, loadSummaryHistory]);

  const handleGenerateStream = async () => {
    if (!file.id) return;

    setIsStreaming(true);
    setStreamLogs([]);
    setStreamingError(null);
    setIsRegenerateOpen(false);

    // Switch to summary tab
    const summaryTab = document.querySelector('[data-state="inactive"][value="summary"]') as HTMLElement;
    summaryTab?.click();

    try {
      const formData = new FormData();
      formData.append("style", selectedStyle);
      formData.append("language", selectedLanguage);
      if (customInstructions) formData.append("custom_instructions", customInstructions);

      // Use the new endpoint implemented in FileHandler
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
      const response = await fetch(
        `${baseUrl}/files/${file.id}/summarize-stream`,
        {
          method: "POST",
          headers: {
            // "Authorization": "Bearer ...", // Handled by cookie/browser usually, or needs explicit header if token-based
            // NextPDF uses HttpOnly cookies for auth, so credentials: "include" might be needed if cross-origin
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Connection failed");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonStr = line.replace("data: ", "");
              const data = JSON.parse(jsonStr);

              if (data.log) {
                setStreamLogs(prev => [...prev, data.log]);
              } else if (data.result) {
                // Streaming finished successfully
                // Refresh summary data from backend to get the standard format
                // The backend implementation of SummarizeStream saves the result to DB.
                // We add a small delay to ensure DB transaction commits before we fetch
                await new Promise(r => setTimeout(r, 500));
                await loadSummary(file.id);
                await loadSummaryHistory(file.id);
                setIsStreaming(false);
                toast.success("Summary generated successfully");
              } else if (data.error) {
                throw new Error(data.error);
              }
            } catch (e: any) {
              console.error("Error parsing stream:", e);
              // Don't error out on incomplete chunks, just ignore
              // But if it's a real error, handle it
            }
          }
        }
      }

    } catch (err: any) {
      console.error("Stream error:", err);
      setStreamingError(err.message || "Failed to generate summary");
      setIsStreaming(false);
      toast.error("Failed to generate summary", {
        description: err.message,
      });
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms) return "0ms";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLanguageName = (langCode: string) => {
    return LANGUAGES.find(l => l.id === langCode)?.name || langCode;
  };

  const getLanguageFlag = (langCode: string) => {
    return LANGUAGES.find(l => l.id === langCode)?.flag || "🌐";
  };

  const SummaryForm = ({ isRegenerate = false }) => (
    <div className="space-y-4">
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
        <Label htmlFor="language">
          <Languages className="h-4 w-4 inline mr-1" />
          Summary Language
        </Label>
        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
          <SelectTrigger id="language">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.id} value={lang.id}>
                <span className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="instructions">
          Custom Instructions{" "}
          <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="instructions"
          placeholder="e.g., Focus on methodology and key findings."
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          maxLength={500}
          rows={4}
        />
        <p className="text-xs text-muted-foreground text-right">
          {customInstructions.length}/500
        </p>
      </div>

      <Button
        className="w-full"
        onClick={handleGenerateStream}
        disabled={isStreaming || file.status === "processing"}
      >
        {isStreaming ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            {isRegenerate ? "Regenerate Summary" : "Generate Summary"}
          </>
        )}
      </Button>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="summary" className="flex h-full flex-col">
        <div className="border-b px-4 py-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </div>

        {/* Summary Tab */}
        <TabsContent value="summary" className="flex-1 overflow-hidden m-0 relative">
          <ScrollArea className="h-full">
            <div className="p-4">
              {/* Error Overlay */}
              <AnimatePresence>
                {streamingError && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm p-4">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white p-6 rounded-2xl shadow-xl border border-red-100 max-w-sm text-center"
                    >
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-6 w-6 text-red-600" />
                      </div>
                      <h3 className="font-semibold text-neutral-900 mb-2">Generation Failed</h3>
                      <p className="text-sm text-neutral-600 mb-4">{streamingError}</p>
                      <Button onClick={() => { setStreamingError(null); setIsStreaming(false); }} variant="outline">
                        Dismiss
                      </Button>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {isStreaming ? (
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex items-center gap-2 text-neutral-600 border-b pb-2 mb-2">
                    <Terminal className="h-4 w-4" />
                    <span className="font-semibold">Processing Log</span>
                  </div>
                  {streamLogs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2 text-neutral-600"
                    >
                      <span className="text-neutral-300 select-none">›</span>
                      <span>{log}</span>
                    </motion.div>
                  ))}
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-3 h-5 bg-red-500/50 inline-block ml-2 align-middle"
                  />
                </div>
              ) : isLoadingSummary ? (
                <div className="space-y-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : currentSummary ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-lg leading-tight">
                        {currentSummary.title}
                      </h3>
                      <Dialog open={isRegenerateOpen} onOpenChange={setIsRegenerateOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="shrink-0 rounded-full h-8">
                            <RefreshCw className="h-3 w-3 mr-2" /> Regenerate
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Regenerate Summary</DialogTitle>
                            <DialogDescription>
                              Choose new settings for your summary.
                            </DialogDescription>
                          </DialogHeader>
                          <SummaryForm isRegenerate />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {summaryStyles.find((s) => s.id === currentSummary.style)
                          ?.name || currentSummary.style}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(currentSummary.processing_duration_ms || 0)}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <History className="h-3 w-3" />v{currentSummary.version}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <span>{getLanguageFlag(currentSummary.language)}</span>
                        {getLanguageName(currentSummary.language)}
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
                </motion.div>
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

        {/* Generate Tab */}
        <TabsContent value="generate" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              <SummaryForm />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {isLoadingHistory ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : summaryHistory.length > 0 ? (
                <Accordion type="single" collapsible className="w-full space-y-2">
                  <p className="text-sm text-muted-foreground mb-4 px-1">
                    {summaryHistory.length} summary version{summaryHistory.length > 1 ? 's' : ''} generated
                  </p>
                  {summaryHistory.map((item) => (
                    <AccordionItem
                      key={item.id}
                      value={item.id}
                      className={`border rounded-lg px-3 ${item.is_current ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/40'}`}
                    >
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex flex-1 items-center gap-3 text-left overflow-hidden min-w-0 pr-2">
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate block max-w-full">
                                {item.title || `Version ${item.version}`}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(item.created_at)} • v{item.version}
                            </span>
                          </div>
                          {item.is_current && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 shrink-0 h-6">
                              Current
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3 pt-1">
                        <div className="space-y-3 pl-1">
                          {(item.title && item.title.length > 40) && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Full Title</p>
                              <p className="text-sm leading-relaxed">{item.title}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Language</p>
                              <div className="flex items-center gap-1.5 text-sm">
                                <span>{getLanguageFlag(item.language)}</span>
                                <span>{getLanguageName(item.language)}</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Duration</p>
                              <div className="flex items-center gap-1.5 text-sm">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{formatDuration(item.processing_duration_ms || 0)}</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Style</p>
                              <div className="flex items-center gap-1.5 text-sm">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{summaryStyles.find((s) => s.id === item.style)?.name || item.style}</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Model</p>
                              <div className="flex items-center gap-1.5 text-sm">
                                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{item.model_used || 'Standard'}</span>
                              </div>
                            </div>
                          </div>

                          {item.custom_instructions && (
                            <div className="bg-muted/50 p-2.5 rounded-md mt-2">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Instructions:</p>
                              <p className="text-xs italic opacity-80">{item.custom_instructions}</p>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium">No History Yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Generate a summary to start building history.
                  </p>
                </div>
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
