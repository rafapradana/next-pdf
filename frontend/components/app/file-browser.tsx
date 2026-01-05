"use client";

import { useState, useEffect, useMemo } from "react";
import { useFiles } from "@/lib/file-context";
import { FileItem, FolderTreeItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Search,
  Folder,
  Calendar,
  HardDrive,
  FileUp,
  FolderPlus,
  X,
  Home,
} from "lucide-react";

export function FileBrowser() {
  const { folders, files, selectedFolderId, isLoadingFiles, selectFile, selectFolder } = useFiles();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filterFolder, setFilterFolder] = useState<string>("current");

  // Determine if viewing all documents or specific folder
  const isViewingAll = selectedFolderId === null;

  // Flatten folders for select
  const flatFolders = useMemo(() => {
    const result: { id: string; name: string; depth: number }[] = [];
    const flatten = (items: FolderTreeItem[], depth = 0) => {
      for (const folder of items) {
        result.push({ id: folder.id, name: folder.name, depth });
        if (folder.children) flatten(folder.children, depth + 1);
      }
    };
    flatten(folders);
    return result;
  }, [folders]);

  // Get current folder info
  const currentFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    return flatFolders.find(f => f.id === selectedFolderId) || null;
  }, [selectedFolderId, flatFolders]);

  // Get folder name by ID
  const getFolderName = (folderId: string | null): string => {
    if (!folderId) return "Root";
    const folder = flatFolders.find(f => f.id === folderId);
    return folder?.name || "Unknown";
  };

  // Filter files based on current view and search
  const filteredFiles = useMemo(() => {
    let result = files;

    // Apply folder filter
    if (!isViewingAll) {
      // When in a specific folder, show only that folder's files by default
      if (filterFolder === "current") {
        result = files.filter(f => f.folder_id === selectedFolderId);
      } else if (filterFolder === "all") {
        // Show all files
      } else if (filterFolder === "root") {
        result = files.filter(f => !f.folder_id);
      } else {
        result = files.filter(f => f.folder_id === filterFolder);
      }
    } else {
      // When viewing all, apply filter dropdown
      if (filterFolder === "root") {
        result = files.filter(f => !f.folder_id);
      } else if (filterFolder !== "current" && filterFolder !== "all") {
        result = files.filter(f => f.folder_id === filterFolder);
      }
    }

    // Apply search
    if (appliedSearch) {
      result = result.filter(f => 
        f.original_filename.toLowerCase().includes(appliedSearch.toLowerCase())
      );
    }

    return result;
  }, [files, selectedFolderId, isViewingAll, filterFolder, appliedSearch]);

  // Reset filter when folder changes
  useEffect(() => {
    setFilterFolder("current");
    setSearchQuery("");
    setAppliedSearch("");
  }, [selectedFolderId]);

  const handleSearch = () => {
    setAppliedSearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setAppliedSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      uploaded: "secondary",
      processing: "outline",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  // Stats for current view
  const totalSize = filteredFiles.reduce((acc, f) => acc + f.file_size, 0);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              {!isViewingAll && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => selectFolder(null)}
                >
                  <Home className="h-4 w-4" />
                </Button>
              )}
              <h1 className="text-2xl font-bold">
                {isViewingAll ? "All Documents" : currentFolder?.name || "Folder"}
              </h1>
            </div>
            <p className="text-muted-foreground mt-1">
              {isViewingAll 
                ? "Browse and manage all your PDF documents"
                : `${filteredFiles.length} document${filteredFiles.length !== 1 ? 's' : ''} in this folder`
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent("create-folder"))}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
            <Button
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent("upload-file"))}
            >
              <FileUp className="h-4 w-4 mr-2" />
              Upload PDF
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {isViewingAll ? "Total Files" : "Files in Folder"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{filteredFiles.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Folder className="h-4 w-4" />
                {isViewingAll ? "Total Folders" : "Current Folder"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {isViewingAll ? flatFolders.length : (currentFolder?.name || "Root")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                {isViewingAll ? "Total Size" : "Folder Size"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatFileSize(totalSize)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by filename..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-9"
                  />
                  {searchQuery && (
                    <button
                      onClick={handleClearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button onClick={handleSearch}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
              {isViewingAll && (
                <Select value={filterFolder} onValueChange={setFilterFolder}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">All Folders</SelectItem>
                    <SelectItem value="root">Root (No Folder)</SelectItem>
                    {flatFolders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        <span style={{ paddingLeft: `${folder.depth * 12}px` }}>
                          {folder.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {appliedSearch && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing results for:</span>
                <Badge variant="secondary" className="gap-1">
                  "{appliedSearch}"
                  <button onClick={handleClearSearch}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Files Table */}
        <Card>
          <CardContent className="p-0">
            {isLoadingFiles ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg">
                  {appliedSearch ? "No documents found" : isViewingAll ? "No documents yet" : "This folder is empty"}
                </h3>
                <p className="text-muted-foreground mt-1 mb-6">
                  {appliedSearch
                    ? "Try adjusting your search"
                    : "Upload your first PDF to get started"}
                </p>
                {!appliedSearch && (
                  <Button
                    onClick={() => window.dispatchEvent(new CustomEvent("upload-file"))}
                  >
                    <FileUp className="h-4 w-4 mr-2" />
                    Upload PDF
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%]">Name</TableHead>
                    {isViewingAll && <TableHead>Folder</TableHead>}
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles.map((file) => (
                    <TableRow
                      key={file.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => selectFile(file)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{file.original_filename}</p>
                            {file.page_count && (
                              <p className="text-xs text-muted-foreground">
                                {file.page_count} pages
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      {isViewingAll && (
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Folder className="h-4 w-4 shrink-0" />
                            <span className="truncate">{getFolderName(file.folder_id)}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatFileSize(file.file_size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(file.uploaded_at)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(file.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Results count */}
        {filteredFiles.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredFiles.length} document{filteredFiles.length !== 1 ? 's' : ''}
            {appliedSearch && ` matching "${appliedSearch}"`}
          </p>
        )}
      </div>
    </div>
  );
}
