"use client";

import { useWorkspace } from "@/lib/workspace-context";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface WorkspaceSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WorkspaceSettingsDialog({ open, onOpenChange }: WorkspaceSettingsDialogProps) {
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { currentWorkspace, refreshWorkspaces } = useWorkspace();

    // Default name when opening
    useEffect(() => {
        if (currentWorkspace && open) {
            setName(currentWorkspace.name);
        }
    }, [currentWorkspace, open]);

    if (!currentWorkspace) return null;

    const handleSave = async () => {
        if (!name.trim()) return;

        setIsLoading(true);
        try {
            await api.updateWorkspace(currentWorkspace.id, name);
            toast.success("Workspace updated");
            refreshWorkspaces();
            onOpenChange(false);
        } catch (error) {
            toast.error("Failed to update workspace");
        } finally {
            setIsLoading(false);
        }
    };

    const copyInviteCode = () => {
        if (currentWorkspace.invite_code) {
            navigator.clipboard.writeText(currentWorkspace.invite_code);
            toast.success("Invite code copied to clipboard");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Workspace Settings</DialogTitle>
                    <DialogDescription>
                        Manage settings for <strong>{currentWorkspace.name}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Workspace Name</Label>
                        <div className="flex gap-2">
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                readOnly={!currentWorkspace.is_owner}
                            />
                            {currentWorkspace.is_owner && (
                                <Button onClick={handleSave} disabled={isLoading || name === currentWorkspace.name}>
                                    {isLoading ? "Saving..." : "Save"}
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Role</Label>
                        <Input value={currentWorkspace.role.charAt(0).toUpperCase() + currentWorkspace.role.slice(1)} readOnly />
                    </div>

                    {(currentWorkspace.is_owner || currentWorkspace.role === 'admin') && currentWorkspace.invite_code && (
                        <div className="grid gap-2">
                            <Label htmlFor="invite-code">Invite Code</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="invite-code"
                                    value={currentWorkspace.invite_code}
                                    readOnly
                                    className="font-mono"
                                />
                                <Button variant="outline" size="icon" onClick={copyInviteCode}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Share this code with others to let them join this workspace.
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
