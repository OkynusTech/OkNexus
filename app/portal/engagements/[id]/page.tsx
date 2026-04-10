'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getEngagement, loadState } from '@/lib/storage';
import { Engagement } from '@/lib/types';
import { formatDate } from '@/lib/report-utils';
import { ArrowLeft, Calendar, FileText, Shield, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function ClientEngagementDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [engagement, setEngagement] = useState<Engagement | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!params.id) return;

        const userId = localStorage.getItem('ok_portal_user_id');
        if (!userId) { router.push('/client-login'); return; }

        const state = loadState();
        const portalUser = state.clientUsers.find(u => u.id === userId);
        if (!portalUser) { router.push('/client-login'); return; }

        const clientId = portalUser.clientId;
        const engId = typeof params.id === 'string' ? params.id : params.id?.[0];
        if (!engId) return;

        const foundEng = getEngagement(engId);
        if (foundEng) {
            if (foundEng.clientId !== clientId) {
                router.push('/portal/engagements');
                return;
            }
            setEngagement(foundEng);
        }
        setLoading(false);
    }, [params.id, router]);

    if (loading) return <div>Loading...</div>;
    if (!engagement) return <div className="p-8 text-center">Engagement not found.</div>;

    return (
        <div className="space-y-6">
            <Link href="/portal/engagements">
                <Button variant="ghost" size="sm" className="-ml-2 mb-2">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Engagements
                </Button>
            </Link>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold dark:text-white">{engagement.metadata.engagementName}</h1>
                        <Badge variant="outline">{engagement.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-slate-500 mt-2 text-sm">
                        <div className="flex items-center">
                            <Shield className="mr-1 h-3 w-3" />
                            {engagement.metadata.assessmentType}
                        </div>
                        <div className="flex items-center">
                            <Calendar className="mr-1 h-3 w-3" />
                            {formatDate(engagement.metadata.startDate)} - {formatDate(engagement.metadata.endDate)}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" disabled>Download Report (Coming Soon)</Button>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold dark:text-white flex items-center gap-2">
                    Findings
                    <Badge variant="secondary" className="ml-2">{engagement.findings.length}</Badge>
                </h2>

                <div className="grid gap-4">
                    {engagement.findings.map(finding => (
                        <Card key={finding.id} className="p-4 border-l-4" style={{
                            borderLeftColor:
                                finding.severity === 'Critical' ? '#ef4444' :
                                    finding.severity === 'High' ? '#f97316' :
                                        finding.severity === 'Medium' ? '#eab308' :
                                            '#3b82f6'
                        }}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold text-lg">{finding.title}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className={`${finding.severity === 'Critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                                finding.severity === 'High' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                                                    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                            } hover:bg-opacity-80`}>
                                            {finding.severity}
                                        </Badge>
                                        <Badge variant="outline">{finding.status}</Badge>
                                    </div>
                                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                        {finding.description}
                                    </p>
                                </div>
                                <div className="text-right">
                                    {finding.status === 'Fixed' && (
                                        <div className="flex items-center text-green-600 text-sm font-medium">
                                            <CheckCircle className="mr-1 h-4 w-4" /> Fixed
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}

                    {engagement.findings.length === 0 && (
                        <Card className="p-8 text-center text-muted-foreground border-dashed">
                            No findings recorded for this engagement.
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
