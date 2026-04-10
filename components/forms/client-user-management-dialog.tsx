'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trash2, Mail, Plus, UserPlus, Shield } from 'lucide-react';
import { ClientUser, ClientProfile } from '@/lib/types';
import { getClientUsers, createClientUser, deleteClientUser, updateClientUser } from '@/lib/storage';
import { useAuth } from '@/hooks/use-auth';

interface ClientUserManagementDialogProps {
    client: ClientProfile;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ClientUserManagementDialog({ client, open, onOpenChange }: ClientUserManagementDialogProps) {
    const { user } = useAuth();
    const [users, setUsers] = useState<ClientUser[]>([]);
    const [isInviting, setIsInviting] = useState(false);

    // Invite Form State
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [inviteRole, setInviteRole] = useState<'client_admin' | 'client_viewer'>('client_viewer');

    useEffect(() => {
        if (open && client) {
            loadUsers();
        }
    }, [open, client]);

    const loadUsers = () => {
        setUsers(getClientUsers(client.id));
    };

    const handleInvite = () => {
        if (!inviteEmail || !inviteName) return;

        // Mock password hash for demo (in real world, this would be an invitation token)
        // For this demo, we set the password to "password123" automatically
        const demoPasswordHash = "password123";

        createClientUser({
            clientId: client.id,
            email: inviteEmail,
            name: inviteName,
            role: inviteRole,
            status: 'invited',
            invitedBy: user?.user_metadata?.full_name || user?.email || 'Unknown',
            invitedAt: new Date().toISOString(),
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${inviteName}`,
            passwordHash: demoPasswordHash
        });

        // Mock Email Sending
        alert(`Invitation sent to ${inviteEmail}!\n\n(DEMO MODE: Default password is 'password123')`);

        setIsInviting(false);
        setInviteEmail('');
        setInviteName('');
        setInviteRole('client_viewer');
        loadUsers();
    };

    const handleRevoke = (userId: string) => {
        if (confirm('Are you sure you want to revoke access for this user?')) {
            deleteClientUser(userId);
            loadUsers();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Manage Access: {client.companyName}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* User List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-muted-foreground">Authorized Users</h3>
                            <Button
                                size="sm"
                                variant={isInviting ? "secondary" : "default"}
                                onClick={() => setIsInviting(!isInviting)}
                            >
                                {isInviting ? 'Cancel Invite' : <><UserPlus className="mr-2 h-4 w-4" /> Invite User</>}
                            </Button>
                        </div>

                        {/* Invite Form */}
                        {isInviting && (
                            <div className="rounded-md border bg-muted/50 p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Full Name</Label>
                                        <Input
                                            placeholder="Jane Doe"
                                            value={inviteName}
                                            onChange={(e) => setInviteName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email Address</Label>
                                        <Input
                                            placeholder="jane@client.com"
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select value={inviteRole} onValueChange={(val: any) => setInviteRole(val)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="client_viewer">Viewer (Read-only)</SelectItem>
                                            <SelectItem value="client_admin">Admin (Manage Users)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Viewers can see reports and findings. Admins can also invite other users.
                                    </p>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button onClick={handleInvite}>Send Invitation</Button>
                                </div>
                            </div>
                        )}

                        {/* List */}
                        {users.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
                                <Shield className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                                <p>No authorized users yet.</p>
                                <p className="text-sm">Invite stakeholders to give them secure access.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {users.map(user => (
                                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-md bg-card">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={user.avatarUrl} />
                                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-medium flex items-center gap-2">
                                                    {user.name}
                                                    <Badge variant="outline" className="text-xs font-normal">
                                                        {user.role === 'client_admin' ? 'Admin' : 'Viewer'}
                                                    </Badge>
                                                    {user.status === 'invited' && (
                                                        <Badge variant="secondary" className="text-xs">Invited</Badge>
                                                    )}
                                                </div>
                                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <Mail className="h-3 w-3" /> {user.email}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleRevoke(user.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
