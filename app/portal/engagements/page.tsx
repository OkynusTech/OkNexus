'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { getAllEngagements, loadState } from '@/lib/storage';
import { Engagement } from '@/lib/types';
import Link from 'next/link';
import { formatDate } from '@/lib/report-utils';
import { FileText, Calendar, Shield } from 'lucide-react';

export default function ClientEngagementsPage() {
    const [engagements, setEngagements] = useState<Engagement[]>([]);

    useEffect(() => {
        const userId = localStorage.getItem('ok_portal_user_id');
        if (!userId) return;

        const state = loadState();
        const portalUser = state.clientUsers.find(u => u.id === userId);
        if (!portalUser) return;

        const clientId = portalUser.clientId;
        const allEngagements = getAllEngagements();
        const clientEngagements = allEngagements.filter(e => e.clientId === clientId);

        clientEngagements.sort((a, b) =>
            new Date(b.metadata.startDate).getTime() - new Date(a.metadata.startDate).getTime()
        );

        setEngagements(clientEngagements);
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold dark:text-white">My Engagements</h1>
                <p className="text-slate-500 mt-2">
                    History of security assessments and findings.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {engagements.map(eng => (
                    <Link key={eng.id} href={`/portal/engagements/${eng.id}`}>
                        <Card className="h-full hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-indigo-500 bg-white dark:bg-slate-900">
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 p-3">
                                        <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${eng.status === 'In Progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                            eng.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                        }`}>
                                        {eng.status}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-bold text-lg leading-tight mb-1">{eng.metadata.engagementName}</h3>
                                    <p className="text-sm text-muted-foreground">{eng.metadata.assessmentType}</p>
                                </div>

                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                    <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {formatDate(eng.metadata.startDate)}
                                    </div>
                                    <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                                        <FileText className="mr-2 h-4 w-4" />
                                        {eng.findings.length} Findings
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </Link>
                ))}

                {engagements.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed">
                        No engagements found.
                    </div>
                )}
            </div>
        </div>
    );
}
