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
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ArrowUpDown,
  Filter,
  ArrowUp,
  ArrowDown,
  Check,
  ListFilter,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SortKey = "original_filename" | "file_size" | "uploaded_at" | "page_count";
type SortDirection = "asc" | "desc";
type FilterStatus = "all" | "completed" | "processing" | "failed";
type DateFilter = "all" | "today" | "7days" | "30days";

export function FileBrowser() {
  const { folders, files, selectedFolderId, isLoadingFiles, selectFile, selectFolder, renameFile, deleteFile } = useFiles();

  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filterFolder, setFilterFolder] = useState<string>("current");

  // Advanced Sort & Filter State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "uploaded_at",
    direction: "desc"
  });
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Action States
  const [fileToRename, setFileToRename] = useState<FileItem | null>(null);
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Filter and Sort Logic
  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files];

    // 1. Folder Filter
    if (!isViewingAll) {
      if (filterFolder === "current") {
        result = result.filter(f => f.folder_id === selectedFolderId);
      } else if (filterFolder === "root") {
        result = result.filter(f => !f.folder_id);
      } else if (filterFolder !== "all") {
        result = result.filter(f => f.folder_id === filterFolder);
      }
    } else {
      if (filterFolder === "root") {
        result = result.filter(f => !f.folder_id);
      } else if (filterFolder !== "current" && filterFolder !== "all") {
        result = result.filter(f => f.folder_id === filterFolder);
      }
    }

    // 2. Search
    if (appliedSearch) {
      result = result.filter(f =>
        f.original_filename.toLowerCase().includes(appliedSearch.toLowerCase())
      );
    }

    // 3. Status Filter
    if (filterStatus !== "all") {
      result = result.filter(f => f.status === filterStatus);
    }

    // 4. Date Filter
    if (dateFilter !== "all") {
      const now = new Date();
      result = result.filter(f => {
        const fileDate = new Date(f.uploaded_at);
        const diffTime = Math.abs(now.getTime() - fileDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (dateFilter === "today") return diffDays <= 1;
        if (dateFilter === "7days") return diffDays <= 7;
        if (dateFilter === "30days") return diffDays <= 30;
        return true;
      });
    }

    // 5. Sorting
    result.sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      // Handle specific fields
      if (sortConfig.key === "original_filename") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      } else if (sortConfig.key === "uploaded_at") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [files, selectedFolderId, isViewingAll, filterFolder, appliedSearch, filterStatus, dateFilter, sortConfig]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedFiles.length / pageSize);
  const paginatedFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedFiles.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedFiles, currentPage, pageSize]);

  // Reset filters/pagination when folder changes
  useEffect(() => {
    setFilterFolder("current");
    setSearchQuery("");
    setAppliedSearch("");
    setCurrentPage(1);
    // We intentionally keep sort/status/date filters as they might be user preference across folders
  }, [selectedFolderId, selectedFolderId]);

  // Reset pagination when results change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredAndSortedFiles.length, pageSize]);

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

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
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
    return <Badge variant={variants[status] || "secondary"} className="h-5 px-1.5 text-xs font-normal capitalize">{status}</Badge>;
  };

  // Actions Handlers
  const openRename = (e: React.MouseEvent, file: FileItem) => {
    e.stopPropagation();
    setFileToRename(file);
    setNewName(file.original_filename);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToRename) return;

    setIsRenaming(true);
    const result = await renameFile(fileToRename.id, newName);
    setIsRenaming(false);

    if (result.success) {
      toast.success("File renamed successfully");
      setFileToRename(null);
    } else {
      toast.error("Failed to rename file", { description: result.error });
    }
  };

  const openDelete = (e: React.MouseEvent, file: FileItem) => {
    e.stopPropagation();
    setFileToDelete(file);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    setIsDeleting(true);
    const result = await deleteFile(fileToDelete.id);
    setIsDeleting(false);

    if (result.success) {
      toast.success("File deleted successfully");
      setFileToDelete(null);
    } else {
      toast.error("Failed to delete file", { description: result.error });
    }
  };

  // Stats for current view
  const totalSize = filteredAndSortedFiles.reduce((acc, f) => acc + f.file_size, 0);

  // Header Component helper
  const SortableHeader = ({ label, sortKey, className }: { label: string, sortKey: SortKey, className?: string }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <TableHead
        className={cn("h-10 cursor-pointer select-none hover:bg-neutral-100/50 hover:text-foreground transition-colors", className)}
        onClick={() => handleSort(sortKey)}
      >
        <div className="flex items-center gap-1.5">
          {label}
          {isActive ? (
            sortConfig.direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover/header:opacity-100" />
          )}
        </div>
      </TableHead>
    );
  };

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
                : `${filteredAndSortedFiles.length} document${filteredAndSortedFiles.length !== 1 ? 's' : ''} in this folder`
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
          <div className="bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                {isViewingAll ? "Total Files" : "Files in Folder"}
              </p>
              <p className="text-2xl font-bold leading-none text-neutral-900">{filteredAndSortedFiles.length}</p>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <Folder className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                {isViewingAll ? "Total Folders" : "Current Folder"}
              </p>
              <p className="text-xl font-bold leading-none text-neutral-900 truncate max-w-[150px]" title={!isViewingAll ? currentFolder?.name : undefined}>
                {isViewingAll ? flatFolders.length : (currentFolder?.name || "Root")}
              </p>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <HardDrive className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                {isViewingAll ? "Total Size" : "Folder Size"}
              </p>
              <p className="text-2xl font-bold leading-none text-neutral-900">{formatFileSize(totalSize)}</p>
            </div>
          </div>
        </div>

        {/* Search, Sort and Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 bg-white"
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 bg-white">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <span className="hidden sm:inline">Sort</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortConfig.key} onValueChange={(v) => handleSort(v as SortKey)}>
                  <DropdownMenuRadioItem value="original_filename">Name</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="uploaded_at">Date Uploaded</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="file_size">Size</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="page_count">Page Count</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Direction</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sortConfig.direction} onValueChange={(v) => setSortConfig(c => ({ ...c, direction: v as SortDirection }))}>
                  <DropdownMenuRadioItem value="asc">Ascending (A-Z)</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="desc">Descending (Z-A)</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={cn("gap-2 bg-white", (filterStatus !== "all" || dateFilter !== "all") && "border-blue-500 text-blue-600 bg-blue-50")}>
                  <ListFilter className="h-4 w-4" />
                  <span className="hidden sm:inline">Filter</span>
                  {(filterStatus !== "all" || dateFilter !== "all") && (
                    <Badge variant="secondary" className="h-5 px-1 bg-blue-100 text-blue-700 hover:bg-blue-100 ml-auto">
                      {(filterStatus !== "all" ? 1 : 0) + (dateFilter !== "all" ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
                  <DropdownMenuRadioItem value="all">All Statuses</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="completed">Completed</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="processing">Processing</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="failed">Failed</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                  <DropdownMenuRadioItem value="all">All Time</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="today">Today</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="7days">Last 7 Days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="30days">Last 30 Days</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                {(filterStatus !== "all" || dateFilter !== "all") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="justify-center text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                      onClick={() => { setFilterStatus("all"); setDateFilter("all"); }}
                    >
                      Reset Filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isViewingAll && (
            <Select value={filterFolder} onValueChange={setFilterFolder}>
              <SelectTrigger className="w-full sm:w-[200px] bg-white">
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
          <div className="mt-[-1rem] flex items-center gap-2 text-sm text-muted-foreground">
            <span>Showing results for:</span>
            <Badge variant="secondary" className="gap-1">
              "{appliedSearch}"
              <button onClick={handleClearSearch}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}

        {/* Files Table */}
        <Card className="overflow-hidden border shadow-sm flex flex-col">
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
            ) : filteredAndSortedFiles.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg">
                  {appliedSearch || filterStatus !== 'all' || dateFilter !== 'all'
                    ? "No documents found"
                    : isViewingAll ? "No documents yet" : "This folder is empty"}
                </h3>
                <p className="text-muted-foreground mt-1 mb-6">
                  {appliedSearch || filterStatus !== 'all' || dateFilter !== 'all'
                    ? "Try adjusting your search or filters"
                    : "Upload your first PDF to get started"}
                </p>
                {!appliedSearch && filterStatus === 'all' && dateFilter === 'all' && (
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
                <TableHeader className="bg-neutral-50/50">
                  <TableRow className="hover:bg-transparent group/header">
                    <SortableHeader label="Name" sortKey="original_filename" className="w-[40%]" />
                    {isViewingAll && <TableHead className="h-10">Folder</TableHead>}
                    <SortableHeader label="Size" sortKey="file_size" />
                    <SortableHeader label="Uploaded" sortKey="uploaded_at" />
                    <TableHead className="h-10">Status</TableHead>
                    <TableHead className="w-[50px] h-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedFiles.map((file) => (
                    <TableRow
                      key={file.id}
                      className="cursor-pointer hover:bg-neutral-50/50 group h-[60px]"
                      onClick={() => selectFile(file)}
                    >
                      <TableCell className="py-2">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate text-neutral-900">{file.original_filename}</p>
                            {file.page_count && (
                              <p className="text-[11px] text-muted-foreground">
                                {file.page_count} pages
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      {isViewingAll && (
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                            <Folder className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate max-w-[120px]">{getFolderName(file.folder_id)}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm py-2">
                        {formatFileSize(file.file_size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm py-2">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(file.uploaded_at)}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">{getStatusBadge(file.status)}</TableCell>
                      <TableCell className="py-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => openRename(e, file)}>
                              <Pencil className="mr-2 h-4 w-4" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => openDelete(e, file)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Fill empty rows to maintain height if needed, OR just leave it dynamic */}
                </TableBody>
              </Table>
            )}
          </CardContent>

          {/* Pagination Footer */}
          {filteredAndSortedFiles.length > 0 && (
            <CardFooter className="border-t p-4 flex items-center justify-between bg-neutral-50/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}
                >
                  <SelectTrigger className="h-8 w-[70px] bg-white">
                    <SelectValue placeholder={pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[5, 10, 20, 50].map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="ml-2">
                  Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredAndSortedFiles.length)} of {filteredAndSortedFiles.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Rename Dialog */}
      <Dialog open={!!fileToRename} onOpenChange={(open) => !open && setFileToRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>
              Enter a new name for the file.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filename">Filename</Label>
              <Input
                id="filename"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter filename"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFileToRename(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isRenaming}>
                {isRenaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Rename
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete
              <span className="font-semibold text-foreground"> {fileToDelete?.original_filename} </span>
              and all of its summaries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
