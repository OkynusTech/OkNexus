'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, FileText, Settings, Download, LogOut, User, Building2, Users, Folder, Trash2, TrendingUp, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getAllEngagements, getAllServiceProviders, getAllClients, exportData, getAllApplications, getAllEngineers, getAllArtifacts, getAllComponents, deleteEngagement } from '@/lib/storage';
import { formatDate, calculateFindingStats } from '@/lib/report-utils';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { Engagement, ServiceProviderProfile, ClientProfile } from '@/lib/types';

export default function Dashboard() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProviderProfile[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);

  const loadData = () => {
    setEngagements(getAllEngagements());
    setServiceProviders(getAllServiceProviders());
    setClients(getAllClients());
    setApplications(getAllApplications());
    setEngineers(getAllEngineers());
    setArtifacts(getAllArtifacts());
    setComponents(getAllComponents());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-reports-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteEngagement = (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete engagement "${name}"? This will delete all findings and evidence.`)) {
      if (deleteEngagement(id)) {
        loadData();
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-2 text-muted-foreground">Overview of your security engagements and findings.</p>
          </div>
          <div className="flex gap-3 items-start">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
            <Link href="/engagement/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Engagement
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="mb-8 grid gap-4 grid-cols-2 lg:grid-cols-5">
          <Link href="/analytics">
            <Card className="p-6 cursor-pointer transition-all hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-purple-600 p-3">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Analytics</h3>
                  <p className="text-sm text-muted-foreground">Executive Insights</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/clients">
            <Card className="p-6 cursor-pointer transition-all hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-orange-600 p-3">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Clients</h3>
                  <p className="text-sm text-muted-foreground">
                    {clients.length} client{clients.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/applications">
            <Card className="p-6 cursor-pointer transition-all hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-blue-600 p-3">
                  <Folder className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Applications</h3>
                  <p className="text-sm text-muted-foreground">
                    {applications.length} application{applications.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/engineers">
            <Card className="p-6 cursor-pointer transition-all hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-purple-600 p-3">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Engineers</h3>
                  <p className="text-sm text-muted-foreground">
                    {engineers.length} engineer{engineers.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/artifacts">
            <Card className="p-6 cursor-pointer transition-all hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-green-600 p-3">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Artifacts</h3>
                  <p className="text-sm text-muted-foreground">
                    {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Engagements</p>
                <p className="mt-2 text-3xl font-bold">{engagements.length}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Service Providers</p>
                <p className="mt-2 text-3xl font-bold">{serviceProviders.length}</p>
              </div>
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
        </div>

        {/* Engagements List */}
        <div>
          <h2 className="mb-6 text-2xl font-bold">Recent Engagements</h2>
          {engagements.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No engagements yet</h3>
              <p className="mt-2 text-muted-foreground">
                Create your first engagement to start generating security reports
              </p>
              <Link href="/engagement/new">
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Engagement
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid gap-4">
              {engagements.map((engagement) => {
                const client = clients.find((c) => c.id === engagement.clientId);
                const stats = calculateFindingStats(engagement.findings);

                return (
                  <Link key={engagement.id} href={`/engagement/${engagement.id}`}>
                    <Card className="p-6 transition-colors hover:bg-accent">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">
                            {engagement.metadata.engagementName}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {client?.companyName || 'Unknown Client'} • {engagement.metadata.assessmentType}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatDate(engagement.metadata.startDate)} - {formatDate(engagement.metadata.endDate)}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {stats.critical > 0 && (
                              <SeverityBadge severity="Critical" className="text-xs">
                                {stats.critical} Critical
                              </SeverityBadge>
                            )}
                            {stats.high > 0 && (
                              <SeverityBadge severity="High" className="text-xs">
                                {stats.high} High
                              </SeverityBadge>
                            )}
                            {stats.medium > 0 && (
                              <SeverityBadge severity="Medium" className="text-xs">
                                {stats.medium} Medium
                              </SeverityBadge>
                            )}
                            {stats.low > 0 && (
                              <SeverityBadge severity="Low" className="text-xs">
                                {stats.low} Low
                              </SeverityBadge>
                            )}
                            {stats.informational > 0 && (
                              <SeverityBadge severity="Informational" className="text-xs">
                                {stats.informational} Info
                              </SeverityBadge>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col items-end gap-2 text-right">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => handleDeleteEngagement(e, engagement.id, engagement.metadata.engagementName)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                              {engagement.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {stats.total} finding{stats.total !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
