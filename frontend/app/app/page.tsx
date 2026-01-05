"use client";

import { useEffect, useState } from "react";
import { useFiles } from "@/lib/file-context";
import { api } from "@/lib/api";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PDFViewer } from "@/components/app/pdf-viewer";
import { SummaryPanel } from "@/components/app/summary-panel";
import { FileBrowser } from "@/components/app/file-browser";
import { Button } from "@/components/ui/button";
import { FileText, Home, X } from "lucide-react";

export default function AppPage() {
  const { selectedFile, selectedFolderId, folders, selectFile } = useFiles();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Get folder name for breadcrumb
  const getFolderName = (folderId: string | null): string | null => {
    if (!folderId) return null;
    const findFolder = (items: typeof folders): string | null => {
      for (const folder of items) {
        if (folder.id === folderId) return folder.name;
        if (folder.children) {
          const found = findFolder(folder.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findFolder(folders);
  };

  const folderName = getFolderName(selectedFolderId);

  // Load PDF URL when file is selected
  useEffect(() => {
    const loadPdfUrl = async () => {
      if (!selectedFile) {
        setPdfUrl(null);
        return;
      }

      const response = await api.getDownloadUrl(selectedFile.id);
      if (response.data) {
        setPdfUrl(response.data.download_url);
      }
    };

    loadPdfUrl();
  }, [selectedFile]);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb className="flex-1">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink 
                href="/app" 
                className="flex items-center gap-1"
                onClick={(e) => { e.preventDefault(); selectFile(null); }}
              >
                <Home className="h-4 w-4" />
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            {folderName && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{folderName}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
            {selectedFile && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    <span className="max-w-[200px] truncate">{selectedFile.original_filename}</span>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        {selectedFile && (
          <Button variant="ghost" size="sm" onClick={() => selectFile(null)}>
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {selectedFile ? (
          <ResizablePanelGroup direction="horizontal">
            {/* PDF Viewer */}
            <ResizablePanel defaultSize={65} minSize={40}>
              <PDFViewer url={pdfUrl} filename={selectedFile.original_filename} />
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Summary Panel */}
            <ResizablePanel defaultSize={35} minSize={25}>
              <SummaryPanel file={selectedFile} />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <FileBrowser />
        )}
      </div>
    </div>
  );
}
