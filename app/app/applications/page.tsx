'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Building2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    getAllApplications,
    getAllClients,
    getAllEngagements,
    createApplication,
    deleteApplication
} from '@/lib/storage';
import { Application, ClientProfile, Engagement } from '@/lib/types';
import { getHistoricalContext } from '@/lib/engagement-history';

export default function ApplicationsPage() {
    const [applications, setApplications] = useState<Application[]>([]);
    const [clients, setClients] = useState<ClientProfile[]>([]);
    const [engagements, setEngagements] = useState<Engagement[]>([]);
    const [groupedByClient, setGroupedByClient] = useState<Map<string, Application[]>>(new Map());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        const apps = getAllApplications();
        const allClients = getAllClients();
        const allEngagements = getAllEngagements();

        setApplications(apps);
        setClients(allClients);
        setEngagements(allEngagements);

        // Group applications by client
        const grouped = new Map<string, Application[]>();
        apps.forEach(app => {
            const clientApps = grouped.get(app.clientId) || [];
            clientApps.push(app);
            grouped.set(app.clientId, clientApps);
        });
        setGroupedByClient(grouped);
    };

    const getEngagementCount = (applicationId: string): number => {
        return engagements.filter(e => e.applicationId === applicationId).length;
    };

    const getClientName = (clientId: string): string => {
        return clients.find(c => c.id === clientId)?.companyName || 'Unknown Client';
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold">Applications</h1>
                        <p className="mt-1 text-muted-foreground">
                            Manage applications and track security assessments across engagements
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/">
                            <Button variant="outline">← Dashboard</Button>
                        </Link>
                    </div>
                </div>

                {/* Info Card */}
                <Card className="mb-8 p-4 border-blue-600 bg-blue-600/5">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-blue-600">Engagement Memory System</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Applications are now first-class entities. Each application can have multiple engagements,
                                allowing OkNexus to track history, recurring vulnerabilities, and team continuity across assessments.
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Stats */}
                <div className="mb-8 grid gap-4 md:grid-cols-3">
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Applications</p>
                                <p className="mt-2 text-3xl font-bold">{applications.length}</p>
                            </div>
                            <Building2 className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </Card>
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                                <p className="mt-2 text-3xl font-bold">{clients.length}</p>
                            </div>
                            <Building2 className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </Card>
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Engagements</p>
                                <p className="mt-2 text-3xl font-bold">{engagements.length}</p>
                            </div>
                            <Building2 className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </Card>
                </div>

                {/* Applications by Client */}
                <div>
                    <h2 className="mb-4 text-2xl font-bold">Applications by Client</h2>

                    {clients.length === 0 ? (
                        <Card className="p-12 text-center">
                            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">No clients yet</h3>
                            <p className="mt-2 text-muted-foreground">
                                Create a client in Settings to start adding applications
                            </p>
                            <Link href="/settings">
                                <Button className="mt-4">Go to Settings</Button>
                            </Link>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {clients.map(client => {
                                const clientApps = groupedByClient.get(client.id) || [];

                                return (
                                    <div key={client.id}>
                                        <h3 className="text-xl font-semibold mb-3 text-blue-600">
                                            {client.companyName}
                                        </h3>

                                        {clientApps.length === 0 ? (
                                            <Card className="p-6 text-center border-dashed">
                                                <p className="text-muted-foreground">
                                                    No applications for this client yet
                                                </p>
                                            </Card>
                                        ) : (
                                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                {clientApps.map(app => {
                                                    const engagementCount = getEngagementCount(app.id);
                                                    const context = engagementCount > 0 ? getHistoricalContext(app.id) : null;

                                                    return (
                                                        <Link key={app.id} href={`/applications/${app.id}`}>
                                                            <Card className="p-6 h-full transition-colors hover:bg-accent cursor-pointer">
                                                                <h4 className="font-semibold text-lg">{app.name}</h4>
                                                                {app.description && (
                                                                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                                                        {app.description}
                                                                    </p>
                                                                )}

                                                                {app.technologyStack && app.technologyStack.length > 0 && (
                                                                    <div className="mt-3 flex flex-wrap gap-1">
                                                                        {app.technologyStack.slice(0, 3).map((tech, idx) => (
                                                                            <span
                                                                                key={idx}
                                                                                className="inline-flex items-center rounded-md bg-blue-600/10 px-2 py-1 text-xs font-medium text-blue-600"
                                                                            >
                                                                                {tech}
                                                                            </span>
                                                                        ))}
                                                                        {app.technologyStack.length > 3 && (
                                                                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium">
                                                                                +{app.technologyStack.length - 3} more
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                <div className="mt-4 pt-4 border-t">
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-muted-foreground">
                                                                            {engagementCount} engagement{engagementCount !== 1 ? 's' : ''}
                                                                        </span>
                                                                        {context && context.recurringVulnerabilityClasses.length > 0 && (
                                                                            <span className="text-red-600 font-medium">
                                                                                {context.recurringVulnerabilityClasses.length} recurring issue{context.recurringVulnerabilityClasses.length !== 1 ? 's' : ''}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
