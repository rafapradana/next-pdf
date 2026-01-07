"use client";

import { useState, useCallback } from "react";
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
}

export default function TryPage() {
    const [file, setFile] = useState<File | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<GuestSummary | null>(null);

    // Form state
    const [style, setStyle] = useState("bullet_points");
    const [language, setLanguage] = useState("en");
    const [customInstructions, setCustomInstructions] = useState("");

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

            // Create blob URL for preview
            const url = URL.createObjectURL(pdfFile);
            setPdfUrl(url);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/pdf": [".pdf"],
        },
        maxFiles: 1,
        multiple: false,
    });

    const handleGenerateSummary = async () => {
        if (!file) return;

        setIsLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("style", style);
            formData.append("language", language);
            if (customInstructions) {
                formData.append("custom_instructions", customInstructions);
            }

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/v1/guest/summarize`,
                {
                    method: "POST",
                    body: formData,
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || "Failed to generate summary");
            }

            setSummary(data.data);
        } catch (err: any) {
            setError(err.message || "Failed to generate summary");
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl);
        }
        setFile(null);
        setPdfUrl(null);
        setSummary(null);
        setError(null);
        setStyle("bullet_points");
        setLanguage("en");
        setCustomInstructions("");
    };

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    // Empty state - Upload UI
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
                            Upload a PDF and get an instant AI-powered summary. No account required.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                    >
                        <div
                            {...getRootProps()}
                            className={`
                relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer
                transition-all duration-300 bg-white
                ${isDragActive
                                    ? "border-red-500 bg-red-50"
                                    : "border-neutral-200 hover:border-red-300 hover:bg-red-50/30"
                                }
              `}
                        >
                            <input {...getInputProps()} />

                            <div className="flex flex-col items-center gap-4">
                                <div className={`
                  h-16 w-16 rounded-2xl flex items-center justify-center transition-colors
                  ${isDragActive ? "bg-red-100" : "bg-neutral-100"}
                `}>
                                    <Upload className={`h-8 w-8 ${isDragActive ? "text-red-600" : "text-neutral-400"}`} />
                                </div>

                                <div>
                                    <p className="text-lg font-medium text-neutral-900 mb-1">
                                        {isDragActive ? "Drop your PDF here" : "Drag & drop your PDF here"}
                                    </p>
                                    <p className="text-neutral-500">
                                        or click to browse • Max 10MB
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Trust badges */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="flex items-center justify-center gap-6 mt-8 text-sm text-neutral-500"
                    >
                        <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-green-600" />
                            <span>Secure & Private</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <span>Instant Results</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-red-600" />
                            <span>AI Powered</span>
                        </div>
                    </motion.div>

                    {/* Note about no storage */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                        className="text-center text-xs text-neutral-400 mt-6"
                    >
                        🔒 Your files are processed securely and never stored on our servers
                    </motion.p>
                </div>
            </div>
        );
    }

    // File loaded - Split view
    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-4rem)]">
            {/* Top bar with file info */}
            <div className="flex items-center justify-between border-b bg-white px-4 py-2">
                <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-neutral-900 truncate max-w-[300px]">
                        {file.name}
                    </span>
                    <span className="text-xs text-neutral-400">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                    <X className="h-4 w-4 mr-1" /> Close
                </Button>
            </div>

            {/* Split panels */}
            <ResizablePanelGroup direction="horizontal" className="flex-1">
                {/* PDF Viewer */}
                <ResizablePanel defaultSize={60} minSize={40}>
                    <PDFViewer url={pdfUrl} filename={file.name} />
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Summary Panel */}
                <ResizablePanel defaultSize={40} minSize={25}>
                    <div className="h-full flex flex-col bg-white border-l">
                        {/* Panel Header */}
                        <div className="flex items-center gap-2 p-4 border-b bg-neutral-50">
                            <Sparkles className="h-5 w-5 text-red-600" />
                            <h2 className="font-semibold text-neutral-900">AI Summary</h2>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            {/* Error */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-sm text-red-600"
                                    >
                                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Summary content */}
                            {summary ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4"
                                >
                                    {/* Title */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-neutral-900">
                                            {summary.title}
                                        </h3>
                                    </div>

                                    {/* Content */}
                                    <div className="prose prose-sm prose-neutral max-w-none">
                                        <div
                                            dangerouslySetInnerHTML={{
                                                __html: formatMarkdown(summary.content),
                                            }}
                                        />
                                    </div>

                                    {/* Metadata */}
                                    <div className="flex flex-wrap gap-2 pt-4 border-t text-xs text-neutral-500">
                                        <span className="px-2 py-1 bg-neutral-100 rounded-full">
                                            ⏱️ {formatDuration(summary.processing_duration_ms)}
                                        </span>
                                        <span className="px-2 py-1 bg-neutral-100 rounded-full">
                                            🤖 {summary.model_used}
                                        </span>
                                        <span className="px-2 py-1 bg-neutral-100 rounded-full">
                                            🌐 {LANGUAGES.find(l => l.id === summary.language)?.name}
                                        </span>
                                    </div>

                                    {/* CTA */}
                                    <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl border border-red-100 mt-6">
                                        <p className="text-sm text-neutral-700 mb-3">
                                            <span className="font-semibold">Like what you see?</span> Sign up to save your summaries, upload more files, and access your document history.
                                        </p>
                                        <Link href="/register">
                                            <Button className="w-full bg-red-600 hover:bg-red-700 text-white">
                                                Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                </motion.div>
                            ) : (
                                /* Generate form */
                                <div className="space-y-4">
                                    {/* Style selector */}
                                    <div className="space-y-2">
                                        <Label className="text-neutral-700">Summary Style</Label>
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

                                    {/* Language selector */}
                                    <div className="space-y-2">
                                        <Label className="text-neutral-700">Language</Label>
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

                                    {/* Custom instructions */}
                                    <div className="space-y-2">
                                        <Label className="text-neutral-700">
                                            Custom Instructions{" "}
                                            <span className="text-neutral-400">(optional)</span>
                                        </Label>
                                        <Textarea
                                            value={customInstructions}
                                            onChange={(e) => setCustomInstructions(e.target.value)}
                                            placeholder="E.g., Focus on key findings, Include statistics..."
                                            className="rounded-xl resize-none"
                                            rows={3}
                                            maxLength={500}
                                        />
                                        <p className="text-xs text-neutral-400 text-right">
                                            {customInstructions.length}/500
                                        </p>
                                    </div>

                                    {/* Generate button */}
                                    <Button
                                        onClick={handleGenerateSummary}
                                        disabled={isLoading}
                                        className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-500/20"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="mr-2 h-5 w-5" />
                                                Generate Summary
                                            </>
                                        )}
                                    </Button>

                                    <p className="text-xs text-center text-neutral-400">
                                        Processing typically takes 10-30 seconds
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}

// Simple markdown formatter
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
