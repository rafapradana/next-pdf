"use client";

import { useFiles } from "@/lib/file-context";
import { Button } from "@/components/ui/button";
import { FileUp, FolderPlus, FileText } from "lucide-react";

export function EmptyState() {
  const { files, selectedFolderId, folders } = useFiles();

  // Get current folder name
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
  const hasFiles = files.length > 0;

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="rounded-full bg-muted p-6 mb-6">
          <FileText className="h-12 w-12 text-muted-foreground" />
        </div>

        {hasFiles ? (
          <>
            <h2 className="text-xl font-semibold mb-2">Select a PDF</h2>
            <p className="text-muted-foreground mb-6">
              Choose a PDF from the sidebar to view it and generate AI summaries.
            </p>
          </>
        ) : selectedFolderId ? (
          <>
            <h2 className="text-xl font-semibold mb-2">
              {folderName ? `"${folderName}" is empty` : "Folder is empty"}
            </h2>
            <p className="text-muted-foreground mb-6">
              Upload your first PDF to this folder to get started.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-2">Welcome to NEXT PDF</h2>
            <p className="text-muted-foreground mb-6">
              Upload PDFs and let AI help you understand them with intelligent
              summaries. Get started by uploading your first document.
            </p>
          </>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              // Trigger folder creation in sidebar
              const event = new CustomEvent("create-folder");
              window.dispatchEvent(event);
            }}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </Button>
          <Button
            onClick={() => {
              // Trigger file upload in sidebar
              const event = new CustomEvent("upload-file");
              window.dispatchEvent(event);
            }}
          >
            <FileUp className="mr-2 h-4 w-4" />
            Upload PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
