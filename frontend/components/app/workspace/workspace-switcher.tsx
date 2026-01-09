"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, Users, Settings, LogOut } from "lucide-react";

import { useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { JoinWorkspaceDialog } from "./join-workspace-dialog";
import { WorkspaceSettingsDialog } from "./workspace-settings-dialog";
import { useRouter } from "next/navigation";

export function WorkspaceSwitcher() {
    const { isMobile } = useSidebar();
    const { workspaces, currentWorkspace, switchWorkspace, isLoadingWorkspaces } = useWorkspace();
    const { logout } = useAuth();
    const router = useRouter();

    const [createOpen, setCreateOpen] = React.useState(false);
    const [joinOpen, setJoinOpen] = React.useState(false);
    const [settingsOpen, setSettingsOpen] = React.useState(false);

    if (isLoadingWorkspaces) {
        return (
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton size="lg">
                        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground animate-pulse"></div>
                        <div className="flex flex-col gap-0.5 leading-none">
                            <div className="h-4 w-20 bg-sidebar-accent animate-pulse rounded"></div>
                        </div>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        );
    }

    return (
        <>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuButton
                                size="lg"
                                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                            >
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                    {currentWorkspace?.name.substring(0, 1).toUpperCase()}
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">
                                        {currentWorkspace?.name || "Select Workspace"}
                                    </span>
                                    <span className="truncate text-xs">
                                        {currentWorkspace?.role}
                                    </span>
                                </div>
                                <ChevronsUpDown className="ml-auto" />
                            </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                            align="start"
                            side={isMobile ? "bottom" : "right"}
                            sideOffset={4}
                        >
                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                                Workspaces
                            </DropdownMenuLabel>
                            {workspaces.map((workspace) => (
                                <DropdownMenuItem
                                    key={workspace.id}
                                    onClick={() => switchWorkspace(workspace.id)}
                                    className="gap-2 p-2"
                                >
                                    <div className="flex size-6 items-center justify-center rounded-sm border">
                                        {workspace.name.substring(0, 1).toUpperCase()}
                                    </div>
                                    {workspace.name}
                                    {currentWorkspace?.id === workspace.id && (
                                        <Check className="ml-auto h-4 w-4" />
                                    )}
                                    {workspace.role === 'owner' && <DropdownMenuShortcut>Owner</DropdownMenuShortcut>}
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 p-2" onClick={() => setCreateOpen(true)}>
                                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                                    <Plus className="size-4" />
                                </div>
                                <div className="font-medium text-muted-foreground">Create Workspace</div>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 p-2" onClick={() => setJoinOpen(true)}>
                                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                                    <Users className="size-4" />
                                </div>
                                <div className="font-medium text-muted-foreground">Join Workspace</div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                                <Settings className="mr-2 h-4 w-4" />
                                Workspace Settings
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>

            <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
            <JoinWorkspaceDialog open={joinOpen} onOpenChange={setJoinOpen} />
            <WorkspaceSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        </>
    );
}
