"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload,
    FileText,
    Loader2,
    Sparkles,
    Shield,
    Clock,
    ArrowRight,
    X,
    AlertCircle,
    RefreshCw,
    Terminal,
    History,
} from "lucide-react";
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
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PDFViewer } from "@/components/app/pdf-viewer";
import Link from "next/link";

// Summary styles
const SUMMARY_STYLES = [
    { id: "bullet_points", name: "Bullet Points", icon: "📋" },
    { id: "paragraph", name: "Paragraph", icon: "📝" },
    { id: "detailed", name: "Detailed", icon: "📚" },
    { id: "executive", name: "Executive", icon: "💼" },
    { id: "academic", name: "Academic", icon: "🎓" },
];

const LANGUAGES = [
    { id: "en", name: "English", flag: "🇺🇸" },
    { id: "id", name: "Indonesia", flag: "🇮🇩" },
];

interface GuestSummary {
    title: string;
    content: string;
    style: string;
    language: string;
    processing_duration_ms: number;
    model_used: string;
    prompt_tokens?: number;
    completion_tokens?: number;
}

export default function TryPage() {
    const [file, setFile] = useState<File | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<GuestSummary | null>(null);

    // Streaming state
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamLogs, setStreamLogs] = useState<string[]>([]);

    // Form input state
    const [style, setStyle] = useState("bullet_points");
    const [language, setLanguage] = useState("en");
    const [customInstructions, setCustomInstructions] = useState("");

    // Modal state
    const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const pdfFile = acceptedFiles[0];
        if (pdfFile) {
            // Validate file size (10MB)
            if (pdfFile.size > 10 * 1024 * 1024) {
                setError("File size exceeds 10MB limit");
                return;
            }

            setFile(pdfFile);
            setError(null);
            setSummary(null);
            setStreamLogs([]); // Reset logs

            // Create blob URL for preview
            const url = URL.createObjectURL(pdfFile);
            setPdfUrl(url);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "application/pdf": [".pdf"] },
        maxFiles: 1,
        multiple: false,
    });

    const handleReset = () => {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setFile(null);
        setPdfUrl(null);
        setSummary(null);
        setError(null);
        setStreamLogs([]);
        setIsStreaming(false);
        setStyle("bullet_points");
        setLanguage("en");
        setCustomInstructions("");
    };

    const handleGenerateStream = async () => {
        if (!file) return;

        setIsStreaming(true);
        setStreamLogs([]);
        setError(null);
        setSummary(null);
        setIsRegenerateOpen(false); // Close modal if open

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("style", style);
            formData.append("language", language);
            if (customInstructions) formData.append("custom_instructions", customInstructions);

            const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
            const response = await fetch(
                `${baseUrl}/api/v1/guest/summarize-stream`,
                {
                    method: "POST",
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
                                setSummary({
                                    ...data.result,
                                    language,
                                    style,
                                    processing_duration_ms: 0, // Calculated by server usually but stream returns it in result if strictly needed, passing 0 for now or updating model
                                    model_used: "gemini-2.0-flash-exp"
                                });
                                setIsStreaming(false);
                            } else if (data.error) {
                                throw new Error(data.error);
                            }
                        } catch (e: any) {
                            if (e.message) setError(e.message);
                        }
                    }
                }
            }

        } catch (err: any) {
            setError(err.message || "Failed to generate summary");
            setIsStreaming(false);
        }
    };

    // UI Components for Form
    const SummaryForm = ({ isRegenerate = false }) => (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Summary Style</Label>
                <Select value={style} onValueChange={setStyle}>
                    <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SUMMARY_STYLES.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                                <span className="flex items-center gap-2">
                                    <span>{s.icon}</span>
                                    <span>{s.name}</span>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
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
            >
                <Sparkles className="mr-2 h-5 w-5" />
                {isRegenerate ? "Regenerate Summary" : "Generate Summary"}
            </Button>
        </div>
    );

    // Empty State
    if (!file) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-2xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="text-center mb-8"
                    >
                        <h1 className="text-3xl font-bold text-neutral-900 mb-3">
                            Try AI PDF Summarizer
                        </h1>
                        <p className="text-neutral-500 text-lg">
                            Recursive parallel summarization for large documents. Instant & Secure.
                        </p>
                    </motion.div>

                    <div
                        {...getRootProps()}
                        className={`
                            relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer
                            transition-all duration-300 bg-white
                            ${isDragActive ? "border-red-500 bg-red-50" : "border-neutral-200 hover:border-red-300 hover:bg-red-50/30"}
                        `}
                    >
                        <input {...getInputProps()} />
                        <div className="flex flex-col items-center gap-4">
                            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-colors ${isDragActive ? "bg-red-100" : "bg-neutral-100"}`}>
                                <Upload className={`h-8 w-8 ${isDragActive ? "text-red-600" : "text-neutral-400"}`} />
                            </div>
                            <div>
                                <p className="text-lg font-medium text-neutral-900 mb-1">
                                    {isDragActive ? "Drop your PDF here" : "Drag & drop your PDF here"}
                                </p>
                                <p className="text-neutral-500">or click to browse • Max 10MB</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-4rem)]">
            <div className="flex items-center justify-between border-b bg-white px-4 py-2">
                <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-neutral-900 truncate max-w-[300px]">{file.name}</span>
                    <span className="text-xs text-neutral-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                    <X className="h-4 w-4 mr-1" /> Close
                </Button>
            </div>

            <ResizablePanelGroup direction="horizontal" className="flex-1">
                <ResizablePanel defaultSize={60} minSize={40}>
                    <PDFViewer url={pdfUrl} filename={file.name} />
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={40} minSize={25}>
                    <div className="h-full flex flex-col bg-white border-l">
                        <Tabs defaultValue="summary" className="flex-1 flex flex-col">
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

                            <TabsContent value="summary" className="flex-1 flex flex-col p-0 m-0 overflow-hidden relative">
                                <ScrollArea className="flex-1 p-4">
                                    {/* Error Overlay */}
                                    <AnimatePresence>
                                        {error && (
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
                                                    <p className="text-sm text-neutral-600 mb-4">{error}</p>
                                                    <Button onClick={() => { setError(null); setIsStreaming(false); }} variant="outline">
                                                        Dismiss
                                                    </Button>
                                                </motion.div>
                                            </div>
                                        )}
                                    </AnimatePresence>

                                    {/* Streaming Log View */}
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
                                    ) : summary ? (
                                        // Summary Result
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <h3 className="text-lg font-bold text-neutral-900 leading-snug">
                                                    {summary.title}
                                                </h3>
                                                <Dialog open={isRegenerateOpen} onOpenChange={setIsRegenerateOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm" className="shrink-0 rounded-full">
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

                                            <div className="prose prose-sm prose-neutral max-w-none">
                                                <div dangerouslySetInnerHTML={{ __html: formatMarkdown(summary.content) }} />
                                            </div>

                                            {/* Metadata */}
                                            <div className="flex flex-wrap gap-2 pt-4 border-t text-xs text-neutral-500">
                                                <span className="px-2 py-1 bg-neutral-100 rounded-full">
                                                    ✨ {summary.model_used}
                                                </span>
                                                <span className="px-2 py-1 bg-neutral-100 rounded-full">
                                                    📝 {LANGUAGES.find(l => l.id === summary.language)?.name}
                                                </span>
                                                {summary.prompt_tokens && (
                                                    <span className="px-2 py-1 bg-neutral-100 rounded-full">
                                                        🔄 {summary.prompt_tokens + (summary.completion_tokens || 0)} Tokens
                                                    </span>
                                                )}
                                            </div>
                                            {/* CTA */}
                                            <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl border border-red-100 mt-6">
                                                <p className="text-sm text-neutral-700 mb-3">
                                                    <span className="font-semibold">Like what you see?</span> Sign up to save your summaries.
                                                </p>
                                                <Link href="/register">
                                                    <Button className="w-full bg-red-600 hover:bg-red-700 text-white">
                                                        Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        // Initial Form State
                                        <SummaryForm />
                                    )}
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="history" className="flex-1 p-4 m-0 overflow-hidden">
                                <div className="flex flex-col items-center justify-center h-full text-neutral-400 text-center">
                                    <div className="bg-neutral-100 p-4 rounded-full mb-4">
                                        <History className="h-6 w-6" />
                                    </div>
                                    <p className="font-medium">No History Yet</p>
                                    <p className="text-xs max-w-[200px] mt-2">
                                        Sign up to save and access your summary history permanently.
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}

// Reuse existing formatMarkdown
function formatMarkdown(content: string): string {
    return content
        .replace(/^### (.*$)/gim, '<h3 class="font-semibold text-base mt-4 mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="font-semibold text-lg mt-4 mb-2">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="font-bold text-xl mt-4 mb-2">$1</h1>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        .replace(/^[-•]\s+(.*)$/gim, '<li class="ml-4">$1</li>')
        .replace(/(<li.*<\/li>)/gim, '<ul class="list-disc space-y-1 my-2">$1</ul>')
        .replace(/\n\n/g, '</p><p class="my-2">')
        .replace(/\n/g, '<br>');
}
