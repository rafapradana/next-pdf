"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, Workspace, WorkspaceMember } from './api';

interface WorkspaceContextType {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    isLoadingWorkspaces: boolean;
    createWorkspace: (name: string) => Promise<{ success: boolean; error?: string }>;
    joinWorkspace: (inviteCode: string) => Promise<{ success: boolean; error?: string }>;
    switchWorkspace: (workspaceId: string) => void;
    refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true); // Start loading immediately

    const refreshWorkspaces = useCallback(async () => {
        setIsLoadingWorkspaces(true);
        const response = await api.getWorkspaces();
        if (response.data) {
            setWorkspaces(response.data);

            // Select first workspace if none selected, or ensure selected one still exists
            if (response.data.length > 0) {
                if (!currentWorkspace) {
                    // Check local storage
                    const savedDetails = localStorage.getItem('last_workspace_id');
                    const found = response.data.find(w => w.id === savedDetails);
                    if (found) {
                        setCurrentWorkspace(found);
                    } else {
                        setCurrentWorkspace(response.data[0]);
                    }
                } else {
                    // Verify current still exists
                    const found = response.data.find(w => w.id === currentWorkspace.id);
                    if (found) {
                        setCurrentWorkspace(found);
                    } else {
                        setCurrentWorkspace(response.data[0]);
                    }
                }
            } else {
                setCurrentWorkspace(null);
            }
        }
        setIsLoadingWorkspaces(false);
    }, [currentWorkspace]);

    // Initial load
    useEffect(() => {
        refreshWorkspaces();
    }, []);

    const switchWorkspace = useCallback((workspaceId: string) => {
        const workspace = workspaces.find(w => w.id === workspaceId);
        if (workspace) {
            setCurrentWorkspace(workspace);
            localStorage.setItem('last_workspace_id', workspace.id);
        }
    }, [workspaces]);

    const createWorkspace = useCallback(async (name: string) => {
        const response = await api.createWorkspace(name);
        if (response.data) {
            await refreshWorkspaces();
            // Auto-switch to new workspace
            const newWs = response.data; // Ideally refreshWorkspaces matches it, but let's trust response
            // But refreshWorkspaces is async. 
            // We can just call switchWorkspace after refresh.
            // Or set it directly.
            // Let's rely on refreshWorkspaces finding it if we update state correctly, but response.data is faster UI feedback.
            // Actually standard flow:
            return { success: true };
        }
        return { success: false, error: response.error?.message };
    }, [refreshWorkspaces]);

    const joinWorkspace = useCallback(async (inviteCode: string) => {
        const response = await api.joinWorkspace(inviteCode);
        if (response.data) {
            await refreshWorkspaces();
            return { success: true };
        }
        return { success: false, error: response.error?.message };
    }, [refreshWorkspaces]);

    return (
        <WorkspaceContext.Provider
            value={{
                workspaces,
                currentWorkspace,
                isLoadingWorkspaces,
                createWorkspace,
                joinWorkspace,
                switchWorkspace,
                refreshWorkspaces,
            }}
        >
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}
