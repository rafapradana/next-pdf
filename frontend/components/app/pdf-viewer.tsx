"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from "lucide-react";

interface PDFViewerProps {
  url: string | null;
  filename: string;
  pageCount?: number;
}

export function PDFViewer({ url, filename, pageCount }: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = () => {
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
    }
  };

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30">
        <Skeleton className="h-[80%] w-[60%]" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          {pageCount !== undefined && (
            <div className="bg-white px-2 py-1 rounded border text-xs font-medium text-neutral-600 mr-2 shadow-sm">
              {pageCount} Pages
            </div>
          )}
          <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoom <= 50}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[4rem] text-center text-sm">{zoom}%</span>
          <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoom >= 200}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleRotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Container */}
      <div className="relative flex-1 overflow-auto bg-muted/30">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="h-[80%] w-[60%]" />
          </div>
        )}
        <div
          className="flex min-h-full items-center justify-center p-4"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: "center center",
          }}
        >
          <iframe
            src={`${url}#toolbar=0&navpanes=0`}
            className="h-[calc(100vh-10rem)] w-full max-w-4xl rounded-lg border bg-white shadow-lg"
            onLoad={() => setIsLoading(false)}
            title={filename}
          />
        </div>
      </div>
    </div>
  );
}
