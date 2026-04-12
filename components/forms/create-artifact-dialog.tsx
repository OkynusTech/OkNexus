'use client';

import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createArtifact } from '@/lib/storage';
import { getAllClients, getAllApplications, getAllEngagements } from '@/lib/storage';
import { ArtifactType, ArtifactScope, ClientProfile, Application, Engagement } from '@/lib/types';

interface CreateArtifactDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    defaultScope?: ArtifactScope;
    defaultScopeId?: string;
}

export function CreateArtifactDialog({
    open,
    onOpenChange,
    onSuccess,
    defaultScope,
    defaultScopeId
}: CreateArtifactDialogProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState<ArtifactType>('custom-document');
    const [scope, setScope] = useState<ArtifactScope>(defaultScope || 'client');
    const [scopeId, setScopeId] = useState(defaultScopeId || '');
    const [description, setDescription] = useState('');
    const [content, setContent] = useState('');

    const [clients, setClients] = useState<ClientProfile[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);
    const [engagements, setEngagements] = useState<Engagement[]>([]);

    // Load data
    React.useEffect(() => {
        setClients(getAllClients());
        setApplications(getAllApplications());
        setEngagements(getAllEngagements());
    }, []);

    const handleSubmit = () => {
        if (!name.trim()) {
            alert('Please enter artifact name');
            return;
        }

        if (!scopeId.trim()) {
            alert('Please enter scope ID (client ID, application ID, or engagement ID)');
            return;
        }

        if (!content.trim()) {
            alert('Please enter artifact content');
            return;
        }

        createArtifact({
            type,
            scope,
            scopeId: scopeId.trim(),
            name: name.trim(),
            description: description.trim() || undefined,
            content: content.trim(),
            visibility: 'internal-only',
            metadata: {},
            visibility: 'internal-only',
        });

        // Reset form
        setName('');
        setType('custom-document');
        setScope(defaultScope || 'client');
        setScopeId(defaultScopeId || '');
        setDescription('');
        setContent('');

        onSuccess();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Knowledge Artifact</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label>Artifact Name *</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="System Architecture Document"
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <Label>Type *</Label>
                        <Select value={type} onValueChange={(v) => setType(v as ArtifactType)}>
                            <SelectTrigger className="mt-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="scope-document">Scope Document</SelectItem>
                                <SelectItem value="architecture-document">Architecture Document</SelectItem>
                                <SelectItem value="previous-report">Previous Report</SelectItem>
                                <SelectItem value="walkthrough-video">Walkthrough Video</SelectItem>
                                <SelectItem value="walkthrough-transcript">Walkthrough Transcript</SelectItem>
                                <SelectItem value="custom-document">Custom Document</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Scope Level *</Label>
                            <Select value={scope} onValueChange={(v) => setScope(v as ArtifactScope)}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="client">Client-Level</SelectItem>
                                    <SelectItem value="application">Application-Level</SelectItem>
                                    <SelectItem value="engagement">Engagement-Level</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            {scope === 'client' && (
                                <>
                                    <Label>Select Client *</Label>
                                    <Select value={scopeId} onValueChange={setScopeId}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue placeholder="Choose a client" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {clients.map((client) => (
                                                <SelectItem key={client.id} value={client.id}>
                                                    {client.companyName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </>
                            )}

                            {scope === 'application' && (
                                <>
                                    <Label>Select Application *</Label>
                                    <Select value={scopeId} onValueChange={setScopeId}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue placeholder="Choose an application" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {applications.map((app) => (
                                                <SelectItem key={app.id} value={app.id}>
                                                    {app.name} ({clients.find(c => c.id === app.clientId)?.companyName || 'Unknown Client'})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </>
                            )}

                            {scope === 'engagement' && (
                                <>
                                    <Label>Select Engagement *</Label>
                                    <Select value={scopeId} onValueChange={setScopeId}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue placeholder="Choose an engagement" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {engagements.map((eng) => (
                                                <SelectItem key={eng.id} value={eng.id}>
                                                    {eng.metadata.engagementName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </>
                            )}
                        </div>
                    </div>

                    <div>
                        <Label>Description</Label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this artifact"
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <Label>Content *</Label>
                        <Textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Paste the content here (architecture details, scope information, etc.)"
                            className="mt-2"
                            rows={10}
                        />
                        <p className="text-xs text-gray-600 mt-1">
                            This content will be used by AI to provide context-aware suggestions
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit}>
                        <Upload className="mr-2 h-4 w-4" />
                        Add Artifact
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
