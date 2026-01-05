"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { api, FolderTreeItem, FileItem, Summary, SummaryStyle } from './api';

interface FileContextType {
  folders: FolderTreeItem[];
  files: FileItem[];
  selectedFile: FileItem | null;
  selectedFolderId: string | null;
  currentSummary: Summary | null;
  summaryStyles: SummaryStyle[];
  isLoadingFolders: boolean;
  isLoadingFiles: boolean;
  isLoadingSummary: boolean;
  refreshFolders: () => Promise<void>;
  refreshFiles: (folderId?: string | null) => Promise<void>;
  selectFile: (file: FileItem | null) => void;
  selectFolder: (folderId: string | null) => void;
  loadSummary: (fileId: string) => Promise<void>;
  loadSummaryStyles: () => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<{ success: boolean; error?: string }>;
  renameFolder: (id: string, name: string) => Promise<{ success: boolean; error?: string }>;
  moveFolder: (id: string, parentId: string | null) => Promise<{ success: boolean; error?: string }>;
  deleteFolder: (id: string) => Promise<{ success: boolean; error?: string }>;
  uploadFile: (file: File, folderId?: string | null) => Promise<{ success: boolean; error?: string }>;
  moveFile: (id: string, folderId: string | null) => Promise<{ success: boolean; error?: string }>;
  renameFile: (id: string, name: string) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (id: string) => Promise<{ success: boolean; error?: string }>;
  generateSummary: (fileId: string, style: string, customInstructions?: string) => Promise<{ success: boolean; error?: string }>;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export function FileProvider({ children }: { children: React.ReactNode }) {
  const [folders, setFolders] = useState<FolderTreeItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [currentSummary, setCurrentSummary] = useState<Summary | null>(null);
  const [summaryStyles, setSummaryStyles] = useState<SummaryStyle[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const refreshFolders = useCallback(async () => {
    setIsLoadingFolders(true);
    const response = await api.getFolderTree(false, true);
    if (response.data) {
      setFolders(response.data);
    }
    setIsLoadingFolders(false);
  }, []);

  const refreshFiles = useCallback(async (folderId?: string | null) => {
    setIsLoadingFiles(true);
    const response = await api.getFiles({ 
      folder_id: folderId === undefined ? selectedFolderId : folderId,
      sort: '-uploaded_at'
    });
    if (response.data) {
      setFiles(response.data);
    }
    setIsLoadingFiles(false);
  }, [selectedFolderId]);

  const selectFile = useCallback((file: FileItem | null) => {
    setSelectedFile(file);
    if (file) {
      setCurrentSummary(null);
    }
  }, []);

  const selectFolder = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId);
  }, []);

  const loadSummary = useCallback(async (fileId: string) => {
    setIsLoadingSummary(true);
    const response = await api.getSummary(fileId);
    if (response.data && 'content' in response.data) {
      setCurrentSummary(response.data as Summary);
    } else {
      setCurrentSummary(null);
    }
    setIsLoadingSummary(false);
  }, []);

  const loadSummaryStyles = useCallback(async () => {
    const response = await api.getSummaryStyles();
    if (response.data) {
      setSummaryStyles(response.data);
    }
  }, []);

  const createFolder = useCallback(async (name: string, parentId?: string | null) => {
    const response = await api.createFolder(name, parentId);
    if (response.data) {
      await refreshFolders();
      return { success: true };
    }
    return { success: false, error: response.error?.message };
  }, [refreshFolders]);

  const renameFolder = useCallback(async (id: string, name: string) => {
    const response = await api.renameFolder(id, name);
    if (!response.error) {
      await refreshFolders();
      return { success: true };
    }
    return { success: false, error: response.error?.message };
  }, [refreshFolders]);

  const moveFolder = useCallback(async (id: string, parentId: string | null) => {
    const response = await api.moveFolder(id, parentId);
    if (!response.error) {
      await refreshFolders();
      return { success: true };
    }
    return { success: false, error: response.error?.message };
  }, [refreshFolders]);

  const deleteFolder = useCallback(async (id: string) => {
    const response = await api.deleteFolder(id);
    if (!response.error) {
      await refreshFolders();
      if (selectedFolderId === id) {
        setSelectedFolderId(null);
      }
      return { success: true };
    }
    return { success: false, error: response.error?.message };
  }, [refreshFolders, selectedFolderId]);

  const uploadFile = useCallback(async (file: File, folderId?: string | null) => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      return { success: false, error: 'Only PDF files are allowed' };
    }

    // Validate file size (25 MB)
    if (file.size > 26214400) {
      return { success: false, error: 'File size exceeds 25 MB limit' };
    }

    // Get presigned URL
    const presignResponse = await api.getPresignedUploadUrl(
      file.name,
      file.size,
      file.type,
      folderId
    );

    if (!presignResponse.data) {
      return { success: false, error: presignResponse.error?.message || 'Failed to get upload URL' };
    }

    // Upload to MinIO
    try {
      const uploadResponse = await fetch(presignResponse.data.presigned_url, {
        method: 'PUT',
        headers: presignResponse.data.headers,
        body: file,
      });

      if (!uploadResponse.ok) {
        return { success: false, error: 'Failed to upload file' };
      }
    } catch {
      return { success: false, error: 'Failed to upload file' };
    }

    // Confirm upload
    const confirmResponse = await api.confirmUpload(presignResponse.data.upload_id);
    if (confirmResponse.data) {
      await refreshFiles(folderId);
      return { success: true };
    }

    return { success: false, error: confirmResponse.error?.message || 'Failed to confirm upload' };
  }, [refreshFiles]);

  const moveFile = useCallback(async (id: string, folderId: string | null) => {
    const response = await api.moveFile(id, folderId);
    if (!response.error) {
      await refreshFiles();
      return { success: true };
    }
    return { success: false, error: response.error?.message };
  }, [refreshFiles]);

  const renameFile = useCallback(async (id: string, name: string) => {
    const response = await api.renameFile(id, name);
    if (!response.error) {
      await refreshFiles();
      // Update selected file if it's the one being renamed
      if (selectedFile?.id === id) {
        setSelectedFile({ ...selectedFile, original_filename: name });
      }
      return { success: true };
    }
    return { success: false, error: response.error?.message };
  }, [refreshFiles, selectedFile]);

  const deleteFile = useCallback(async (id: string) => {
    const response = await api.deleteFile(id);
    if (!response.error) {
      await refreshFiles();
      if (selectedFile?.id === id) {
        setSelectedFile(null);
        setCurrentSummary(null);
      }
      return { success: true };
    }
    return { success: false, error: response.error?.message };
  }, [refreshFiles, selectedFile]);

  const generateSummary = useCallback(async (fileId: string, style: string, customInstructions?: string) => {
    const response = await api.generateSummary(fileId, style, customInstructions);
    if (response.data) {
      // Poll for summary completion
      const pollSummary = async () => {
        const summaryResponse = await api.getSummary(fileId);
        if (summaryResponse.data && 'content' in summaryResponse.data) {
          setCurrentSummary(summaryResponse.data as Summary);
          return true;
        }
        return false;
      };

      // Poll every 2 seconds for up to 60 seconds
      let attempts = 0;
      const maxAttempts = 30;
      const poll = async () => {
        if (attempts >= maxAttempts) return;
        const done = await pollSummary();
        if (!done) {
          attempts++;
          setTimeout(poll, 2000);
        }
      };
      poll();

      return { success: true };
    }
    return { success: false, error: response.error?.message };
  }, []);

  return (
    <FileContext.Provider
      value={{
        folders,
        files,
        selectedFile,
        selectedFolderId,
        currentSummary,
        summaryStyles,
        isLoadingFolders,
        isLoadingFiles,
        isLoadingSummary,
        refreshFolders,
        refreshFiles,
        selectFile,
        selectFolder,
        loadSummary,
        loadSummaryStyles,
        createFolder,
        renameFolder,
        moveFolder,
        deleteFolder,
        uploadFile,
        moveFile,
        renameFile,
        deleteFile,
        generateSummary,
      }}
    >
      {children}
    </FileContext.Provider>
  );
}

export function useFiles() {
  const context = useContext(FileContext);
  if (context === undefined) {
    throw new Error('useFiles must be used within a FileProvider');
  }
  return context;
}
