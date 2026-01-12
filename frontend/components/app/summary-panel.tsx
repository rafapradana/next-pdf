"use client";

import { useState, useEffect, useRef } from "react";
import { useFiles } from "@/lib/file-context";
import { FileItem, api } from "@/lib/api";
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

const STYLE_ICONS: Record<string, string> = {
  "bullet_points": "📋",
  "paragraph": "📝",
  "detailed": "📚",
  "executive": "💼",
  "academic": "🎓",
};

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
    setCurrentSummary,
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState("summary");

  // Load summary styles on mount
  useEffect(() => {
    loadSummaryStyles();
  }, [loadSummaryStyles]);

  // Load summary and history when file changes
  useEffect(() => {
    if (file.id) {
      loadSummary(file.id);
      loadSummaryHistory(file.id);
      setIsStreaming(false);
      setStreamLogs([]);
      setStreamingError(null);
    }
  }, [file.id, loadSummary, loadSummaryHistory]);

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamLogs]);

  const handleGenerateStream = async () => {
    if (!file.id) return;

    // Strict Frontend Validation
    const isPdf = file.mime_type === 'application/pdf' || file.filename.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      toast.error("Invalid File Type", {
        description: "Summarization is only available for PDF files.",
      });
      return;
    }

    setIsStreaming(true);
    setStreamLogs([]);
    setStreamingError(null);
    setIsRegenerateOpen(false); // Close modal if open

    // Switch to summary tab immediately
    setActiveTab("summary");

    // Start time for duration calculation
    const startTime = Date.now();

    let eventSource: EventSource | null = null;

    try {
      // 1. Submit Job Async (RabbitMQ)
      const res = await api.summarizeAsync(file.id, selectedStyle, customInstructions, selectedLanguage);

      if (res.error) {
        throw new Error(res.error.message);
      }

      // 2. Connect to Event Stream (RabbitMQ Bridge)
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
      const token = api.getAccessToken();

      // Use query param for token (Middleware updated to support this)
      eventSource = new EventSource(`${baseUrl}/api/v1/files/${file.id}/events?token=${token}`);

      eventSource.onopen = () => {
        setStreamLogs(prev => [...prev, "Connected to event stream..."]);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.log) {
            setStreamLogs(prev => [...prev, data.log]);
          }

          if (data.status === 'completed' && data.result) {
            // Success
            const durationMs = Date.now() - startTime;

            // Construct temp summary
            const tempSummary: any = {
              id: "temp-id",
              file_id: file.id,
              version: (currentSummary?.version || 0) + 1,
              title: data.result.title,
              style: selectedStyle,
              content: data.result.content,
              model_used: "Gemini 2.5 Flash",
              processing_duration_ms: durationMs,
              language: selectedLanguage,
              is_current: true,
              created_at: new Date().toISOString(),
              processing_started_at: new Date(startTime).toISOString(),
              processing_completed_at: new Date().toISOString(),
              prompt_tokens: data.result.prompt_tokens || 0,
              completion_tokens: data.result.completion_tokens || 0,
            };

            setCurrentSummary(tempSummary);
            setIsStreaming(false);
            toast.success("Summary generated successfully");

            eventSource?.close();

            // Refresh history
            setTimeout(() => {
              loadSummaryHistory(file.id);
              loadSummary(file.id);
            }, 1000);

          } else if (data.status === 'failed' || data.error) {
            throw new Error(data.error || "Processing failed");
          }

        } catch (e: any) {
          setStreamingError(e.message);
          setIsStreaming(false);
          eventSource?.close();
          toast.error("Processing Error", { description: e.message });
        }
      };

      eventSource.onerror = (e) => {
        console.error("SSE Error:", e);
        // Don't close immediately on minor network jitters unless fatal?
        // Browser usually retries. But if server closes, it errors.
        if (eventSource?.readyState === EventSource.CLOSED) {
          // Closed
          setStreamingError("Connection closed unexpectedly.");
          setIsStreaming(false);
        }
      };

    } catch (err: any) {
      console.error("Generation error:", err);
      setStreamingError(err.message || "Failed to start generation");
      setIsStreaming(false);
      eventSource?.close();
      toast.error("Failed to generate", {
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
        <Label>Summary Style</Label>
        <Select value={selectedStyle} onValueChange={setSelectedStyle}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {summaryStyles.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2">
                  <span>{STYLE_ICONS[s.id] || "📄"}</span>
                  <span>{s.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Language</Label>
        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                <span className="flex items-center gap-2">
                  <span>{l.flag}</span>
                  <span>{l.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Custom Instructions <span className="text-neutral-400">(optional)</span></Label>
        <Textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="E.g., Focus on key findings..."
          className="rounded-xl resize-none"
          rows={3}
          maxLength={500}
        />
      </div>

      <Button
        onClick={handleGenerateStream}
        className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-500/20"
        disabled={isStreaming}
      >
        {isStreaming ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            {isRegenerate ? "Regenerate Summary" : "Generate Summary"}
          </>
        )}
      </Button>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white border-l">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 border-b bg-neutral-50">
          <TabsList className="bg-transparent h-14 p-0 space-x-4">
            <TabsTrigger value="summary" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none h-full px-2">
              <Sparkles className="h-4 w-4 mr-2" /> Summary
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none h-full px-2">
              <History className="h-4 w-4 mr-2" /> History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="summary" className="flex-1 relative m-0 p-0">
          <div className="absolute inset-0 overflow-auto p-4">
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

            {/* Content Logic */}
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
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : currentSummary ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Header: Title + Metadata Chips */}
                <div className="space-y-2.5">
                  <h3 className="text-lg font-bold text-neutral-900 leading-snug pr-2">
                    {currentSummary.title?.replace(/^\*+\s*/, '') || 'Summary'}
                  </h3>

                  {/* Inline Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded" title="AI Model">
                      ✨ {currentSummary.model_used?.replace('gemini-', '') || "2.5-flash"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded" title="Language">
                      {getLanguageFlag(currentSummary.language)} {getLanguageName(currentSummary.language)}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded" title="Summary Style">
                      {STYLE_ICONS[currentSummary.style] || "📄"} {summaryStyles.find(s => s.id === currentSummary.style)?.name || currentSummary.style}
                    </span>
                    {currentSummary.prompt_tokens > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded" title="Token Usage">
                        🔢 {currentSummary.prompt_tokens + (currentSummary.completion_tokens || 0)}
                      </span>
                    )}
                    {file.page_count && file.page_count > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded" title="Page Count">
                        📄 {file.page_count} Pages
                      </span>
                    )}
                    {currentSummary.processing_duration_ms > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded" title="Processing Time">
                        ⏱️ {(currentSummary.processing_duration_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t" />

                {/* Content */}
                <div className="prose prose-sm prose-neutral max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: formatMarkdown(currentSummary.content) }} />
                </div>

                {/* Regenerate Button - Fixed at Bottom */}
                <div className="sticky bottom-0 pt-3 pb-1 bg-gradient-to-t from-white via-white to-transparent -mx-4 px-4">
                  <Dialog open={isRegenerateOpen} onOpenChange={setIsRegenerateOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full h-9 text-sm">
                        <RefreshCw className="h-3.5 w-3.5 mr-2" /> Regenerate Summary
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
              </motion.div>
            ) : (
              // Initial Form State (No summary yet)
              <SummaryForm />
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 relative m-0 p-0">
          <div className="absolute inset-0 overflow-auto p-4">
            {isLoadingHistory ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : summaryHistory.length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                <p className="text-xs text-muted-foreground mb-3">
                  {summaryHistory.length} version{summaryHistory.length > 1 ? 's' : ''}
                </p>
                {summaryHistory.map((item) => (
                  <AccordionItem
                    key={item.id}
                    value={item.id}
                    className="border-b last:border-b-0"
                  >
                    <AccordionTrigger className="hover:no-underline py-2.5 text-left">
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">
                            {item.title || `Version ${item.version}`}
                          </span>
                          {item.is_current && (
                            <Badge variant="secondary" className="bg-red-100 text-red-700 text-[10px] h-5 px-1.5">
                              Current
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(item.created_at)} • v{item.version}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      <div className="space-y-3 text-sm">
                        {/* Metadata Grid */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                          <span>{getLanguageFlag(item.language)} {getLanguageName(item.language)}</span>
                          <span>⏱️ {formatDuration(item.processing_duration_ms || 0)}</span>
                          <span>{STYLE_ICONS[item.style] || "📄"} {summaryStyles.find((s) => s.id === item.style)?.name || item.style}</span>
                        </div>

                        {/* Load Content Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8"
                          onClick={async () => {
                            await loadSummary(file.id, item.version);
                            toast.success("Summary v" + item.version + " loaded successfully");
                            setActiveTab("summary");
                          }}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                          View Full Summary
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-400">
                <History className="h-10 w-10 mb-3 opacity-50" />
                <h3 className="font-medium">No History Yet</h3>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div >
  );
}

function formatMarkdown(content: string): string {
  return content
    .replace(/^### (.*$)/gim, '<h3 class="font-semibold text-base mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="font-semibold text-lg mt-4 mb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="font-bold text-xl mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^[-•*]\s+(.*)$/gim, '<li class="ml-4">$1</li>')
    .replace(/(<li.*<\/li>)/gim, '<ul class="list-disc space-y-1 my-2">$1</ul>')
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, '<br>');
}
