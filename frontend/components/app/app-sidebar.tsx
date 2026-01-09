"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useFiles } from "@/lib/file-context";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, Folder, FolderOpen, FolderPlus, ChevronRight, MoreHorizontal,
  Pencil, Trash2, Upload, LogOut, Settings, User, Home,
} from "lucide-react";
import { FolderTreeItem, FileItem } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "./workspace/workspace-switcher";

type DragItem = { type: "folder"; data: FolderTreeItem } | { type: "file"; data: FileItem };

function FileRow({ file, isSelected, onClick, onRename, onDelete, depth = 0 }: {
  file: FileItem; isSelected: boolean; onClick: () => void; onRename: () => void; onDelete: () => void; depth?: number;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `file-${file.id}`,
    data: { type: "file", data: file } as DragItem,
  });

  return (
    <SidebarMenuItem>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <SidebarMenuButton
            ref={setNodeRef} isActive={isSelected} onClick={onClick}
            className={cn("cursor-pointer", isDragging && "opacity-50")}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            {...attributes} {...listeners}
          >
            <FileText className="h-4 w-4 shrink-0 text-blue-500" />
            <span>{file.original_filename}</span>
          </SidebarMenuButton>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onRename}><Pencil className="mr-2 h-4 w-4" />Rename</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </SidebarMenuItem>
  );
}

function FolderRow({ folder, isExpanded, isSelected, onToggle, onClick, onSubfolder, onRename, onDelete, depth = 0 }: {
  folder: FolderTreeItem; isExpanded: boolean; isSelected: boolean;
  onToggle: () => void; onClick: () => void; onSubfolder: () => void; onRename: () => void; onDelete: () => void; depth?: number;
}) {
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({
    id: `folder-${folder.id}`,
    data: { type: "folder", data: folder } as DragItem,
  });
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `drop-folder-${folder.id}`,
    data: { type: "folder", data: folder },
  });
  const hasChildren = (folder.children?.length ?? 0) > 0 || (folder.file_count ?? 0) > 0;

  return (
    <div ref={dropRef}>
      <SidebarMenuItem>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <SidebarMenuButton
              ref={dragRef} isActive={isSelected} onClick={onClick}
              className={cn("cursor-pointer", isDragging && "opacity-50", isOver && "bg-accent ring-2 ring-primary")}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              {...attributes} {...listeners}
            >
              <ChevronRight
                className={cn("h-4 w-4 shrink-0 transition-transform", isExpanded && "rotate-90", !hasChildren && "invisible")}
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
              />
              {isExpanded ? <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" /> : <Folder className="h-4 w-4 shrink-0 text-amber-500" />}
              <span>{folder.name}</span>
            </SidebarMenuButton>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={onSubfolder}><FolderPlus className="mr-2 h-4 w-4" />New Subfolder</ContextMenuItem>
            <ContextMenuItem onClick={onRename}><Pencil className="mr-2 h-4 w-4" />Rename</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </SidebarMenuItem>
    </div>
  );
}

export function AppSidebar() {
  const { user, logout } = useAuth();
  const {
    folders, files, selectedFile, selectedFolderId, isLoadingFolders,
    refreshFolders, refreshFiles, selectFile, selectFolder,
    createFolder, renameFolder, moveFolder, deleteFolder, uploadFile, moveFile, renameFile, deleteFile,
  } = useFiles();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<DragItem | null>(null);
  const [newFolderDialog, setNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [renameFolderDialog, setRenameFolderDialog] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [renameFileDialog, setRenameFileDialog] = useState(false);
  const [renameFileId, setRenameFileId] = useState<string | null>(null);
  const [renameFileName, setRenameFileName] = useState("");
  const [deleteFolderDialog, setDeleteFolderDialog] = useState(false);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [deleteFileDialog, setDeleteFileDialog] = useState(false);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { setNodeRef: rootDropRef, isOver: isOverRoot } = useDroppable({ id: "drop-root", data: { type: "root" } });

  useEffect(() => { refreshFolders(); refreshFiles(null); }, [refreshFolders, refreshFiles]);

  useEffect(() => {
    const onCreateFolder = () => { setNewFolderParentId(null); setNewFolderDialog(true); };
    const onUpload = () => document.getElementById("file-upload")?.click();
    window.addEventListener("create-folder", onCreateFolder);
    window.addEventListener("upload-file", onUpload);
    return () => { window.removeEventListener("create-folder", onCreateFolder); window.removeEventListener("upload-file", onUpload); };
  }, []);

  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const isDescendant = useCallback((parentId: string, childId: string): boolean => {
    const find = (items: FolderTreeItem[]): boolean => {
      for (const i of items) { if (i.id === childId) return true; if (i.children && find(i.children)) return true; }
      return false;
    };
    const getFolder = (items: FolderTreeItem[]): FolderTreeItem | null => {
      for (const i of items) { if (i.id === parentId) return i; if (i.children) { const f = getFolder(i.children); if (f) return f; } }
      return null;
    };
    const p = getFolder(folders);
    return p?.children ? find(p.children) : false;
  }, [folders]);

  const onDragStart = (e: DragStartEvent) => setActiveItem(e.active.data.current as DragItem);
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveItem(null);
    if (!e.over) return;
    const data = e.active.data.current as DragItem;
    const overId = e.over.id as string;
    const targetId = overId === "drop-root" ? null : overId.startsWith("drop-folder-") ? overId.replace("drop-folder-", "") : null;

    if (data.type === "folder") {
      if (data.data.id === targetId || data.data.parent_id === targetId) return;
      if (targetId && isDescendant(data.data.id, targetId)) { toast.error("Cannot move into subfolder"); return; }
      const r = await moveFolder(data.data.id, targetId);
      r.success ? toast.success("Folder moved") : toast.error(r.error || "Failed");
    } else {
      if (data.data.folder_id === targetId) return;
      const r = await moveFile(data.data.id, targetId);
      if (r.success) { toast.success("File moved"); refreshFiles(selectedFolderId); } else toast.error(r.error || "Failed");
    }
  };

  const doCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const r = await createFolder(newFolderName, newFolderParentId);
    if (r.success) {
      toast.success("Folder created");
      setNewFolderDialog(false); setNewFolderName("");
      if (newFolderParentId) setExpanded(p => new Set([...p, newFolderParentId]));
      setNewFolderParentId(null);
    } else toast.error(r.error || "Failed");
  };

  const doRenameFolder = async () => {
    if (!renameFolderId || !renameFolderName.trim()) return;
    const r = await renameFolder(renameFolderId, renameFolderName);
    r.success ? (toast.success("Renamed"), setRenameFolderDialog(false), setRenameFolderId(null), setRenameFolderName("")) : toast.error(r.error || "Failed");
  };

  const doRenameFile = async () => {
    if (!renameFileId || !renameFileName.trim()) return;
    const r = await renameFile(renameFileId, renameFileName);
    r.success ? (toast.success("Renamed"), setRenameFileDialog(false), setRenameFileId(null), setRenameFileName("")) : toast.error(r.error || "Failed");
  };

  const doDeleteFolder = async () => {
    if (!deleteFolderId) return;
    const r = await deleteFolder(deleteFolderId);
    r.success ? (toast.success("Deleted"), setDeleteFolderDialog(false), setDeleteFolderId(null)) : toast.error(r.error || "Failed");
  };

  const doDeleteFile = async () => {
    if (!deleteFileId) return;
    const r = await deleteFile(deleteFileId);
    r.success ? (toast.success("Deleted"), setDeleteFileDialog(false), setDeleteFileId(null)) : toast.error(r.error || "Failed");
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = await uploadFile(f, selectedFolderId);
    r.success ? toast.success("Uploaded") : toast.error(r.error || "Failed");
    e.target.value = "";
  };

  const rootFiles = files.filter(f => !f.folder_id);

  const renderTree = (items: FolderTreeItem[], depth = 0): React.ReactNode => {
    return items.map(folder => {
      const isExp = expanded.has(folder.id);
      const folderFiles = files.filter(f => f.folder_id === folder.id);
      return (
        <div key={folder.id}>
          <FolderRow
            folder={folder}
            isExpanded={isExp}
            isSelected={selectedFolderId === folder.id}
            onToggle={() => toggle(folder.id)}
            onClick={() => { selectFolder(folder.id); selectFile(null); toggle(folder.id); }}
            onSubfolder={() => { setNewFolderParentId(folder.id); setNewFolderDialog(true); }}
            onRename={() => { setRenameFolderId(folder.id); setRenameFolderName(folder.name); setRenameFolderDialog(true); }}
            onDelete={() => { setDeleteFolderId(folder.id); setDeleteFolderDialog(true); }}
            depth={depth}
          />
          {isExp && (
            <SidebarMenu>
              {folder.children && renderTree(folder.children, depth + 1)}
              {folderFiles.map(file => (
                <FileRow
                  key={file.id}
                  file={file}
                  isSelected={selectedFile?.id === file.id}
                  onClick={() => { selectFile(file); selectFolder(file.folder_id); }}
                  onRename={() => { setRenameFileId(file.id); setRenameFileName(file.original_filename); setRenameFileDialog(true); }}
                  onDelete={() => { setDeleteFileId(file.id); setDeleteFileDialog(true); }}
                  depth={depth + 1}
                />
              ))}
            </SidebarMenu>
          )}
        </div>
      );
    });
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <Sidebar variant="inset">
          <SidebarHeader>
            <WorkspaceSwitcher />
          </SidebarHeader>

          <SidebarContent>
            <ScrollArea className="h-full">
              <SidebarGroup>
                <SidebarGroupContent>
                  <div className="px-2">
                    <label htmlFor="file-upload">
                      <Button className="w-full" asChild><span><Upload className="mr-2 h-4 w-4" />Upload PDF</span></Button>
                    </label>
                    <input id="file-upload" type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup>
                <SidebarGroupLabel><Home className="mr-2 h-4 w-4" />Documents</SidebarGroupLabel>
                <SidebarGroupAction onClick={() => { setNewFolderParentId(null); setNewFolderDialog(true); }} title="New Folder">
                  <FolderPlus className="h-4 w-4" />
                </SidebarGroupAction>
                <SidebarGroupContent>
                  {isLoadingFolders ? (
                    <div className="space-y-2 px-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
                  ) : (
                    <div ref={rootDropRef} className={cn("min-h-[60px] rounded-md", isOverRoot && "bg-accent ring-2 ring-primary")}>
                      <SidebarMenu>
                        {renderTree(folders)}
                        {rootFiles.map(file => (
                          <FileRow
                            key={file.id}
                            file={file}
                            isSelected={selectedFile?.id === file.id}
                            onClick={() => { selectFile(file); selectFolder(null); }}
                            onRename={() => { setRenameFileId(file.id); setRenameFileName(file.original_filename); setRenameFileDialog(true); }}
                            onDelete={() => { setDeleteFileId(file.id); setDeleteFileDialog(true); }}
                          />
                        ))}
                        {folders.length === 0 && rootFiles.length === 0 && (
                          <p className="px-2 py-4 text-sm text-muted-foreground text-center">No documents yet</p>
                        )}
                      </SidebarMenu>
                    </div>
                  )}
                </SidebarGroupContent>
              </SidebarGroup>
            </ScrollArea>
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton>
                      <User className="h-4 w-4" />
                      <span className="truncate">{user?.full_name || user?.email}</span>
                      <MoreHorizontal className="ml-auto h-4 w-4" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
                    <DropdownMenuItem asChild><a href="/app/settings"><Settings className="mr-2 h-4 w-4" />Settings</a></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <DragOverlay>
          {activeItem && (
            <div className="flex items-center gap-2 rounded-md bg-background px-3 py-2 shadow-lg border">
              {activeItem.type === "folder" ? <><Folder className="h-4 w-4 text-amber-500" /><span>{activeItem.data.name}</span></>
                : <><FileText className="h-4 w-4 text-blue-500" /><span>{activeItem.data.original_filename}</span></>}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Dialog open={newFolderDialog} onOpenChange={setNewFolderDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Folder</DialogTitle><DialogDescription>Enter folder name</DialogDescription></DialogHeader>
          <div className="py-4"><Label>Name</Label><Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="mt-2" onKeyDown={e => e.key === "Enter" && doCreateFolder()} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setNewFolderDialog(false)}>Cancel</Button><Button onClick={doCreateFolder}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameFolderDialog} onOpenChange={setRenameFolderDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Folder</DialogTitle></DialogHeader>
          <div className="py-4"><Label>Name</Label><Input value={renameFolderName} onChange={e => setRenameFolderName(e.target.value)} className="mt-2" onKeyDown={e => e.key === "Enter" && doRenameFolder()} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setRenameFolderDialog(false)}>Cancel</Button><Button onClick={doRenameFolder}>Rename</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameFileDialog} onOpenChange={setRenameFileDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename File</DialogTitle></DialogHeader>
          <div className="py-4"><Label>Name</Label><Input value={renameFileName} onChange={e => setRenameFileName(e.target.value)} className="mt-2" onKeyDown={e => e.key === "Enter" && doRenameFile()} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setRenameFileDialog(false)}>Cancel</Button><Button onClick={doRenameFile}>Rename</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteFolderDialog} onOpenChange={setDeleteFolderDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Folder</DialogTitle><DialogDescription>This will delete all contents. Cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteFolderDialog(false)}>Cancel</Button><Button variant="destructive" onClick={doDeleteFolder}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteFileDialog} onOpenChange={setDeleteFileDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete File</DialogTitle><DialogDescription>Cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteFileDialog(false)}>Cancel</Button><Button variant="destructive" onClick={doDeleteFile}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
