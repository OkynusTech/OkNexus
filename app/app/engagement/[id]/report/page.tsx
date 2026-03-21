'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getEngagement, getClient, getServiceProvider } from '@/lib/storage';
import { Engagement, ClientProfile, ServiceProviderProfile } from '@/lib/types';
import { ArrowLeft, Printer } from 'lucide-react';
import { ReportRenderer } from '@/components/report/report-renderer';

export default function ReportPage() {
    const params = useParams();
    const router = useRouter();
    const [engagement, setEngagement] = useState<Engagement | null>(null);
    const [client, setClient] = useState<ClientProfile | null>(null);
    const [provider, setServiceProvider] = useState<ServiceProviderProfile | null>(null);

    useEffect(() => {
        if (params.id) {
            const rawEngagement = getEngagement(params.id as string);
            if (rawEngagement) {
                const engagementData = rawEngagement;
                setEngagement(engagementData);

                if (engagementData.clientId) {
                    setClient(getClient(engagementData.clientId));
                }
                if (engagementData.serviceProviderId) {
                    setServiceProvider(getServiceProvider(engagementData.serviceProviderId));
                }
            }
        }
    }, [params.id]);

    const handlePrint = () => {
        window.print();
    };

    const handlePublish = () => {
        if (!engagement) return;

        if (confirm('Are you sure you want to finalize this report? It will become visible to the client in their portal.')) {
            // In a real app, this would use the updateEngagement function
            // We need to import it or implement it here
            const storedData = localStorage.getItem('security_report_builder_data');
            if (storedData) {
                const parsed = JSON.parse(storedData);
                const engIndex = parsed.engagements.findIndex((e: any) => e.id === engagement.id);
                if (engIndex >= 0) {
                    parsed.engagements[engIndex].status = 'Delivered';
                    parsed.engagements[engIndex].updatedAt = new Date().toISOString();
                    localStorage.setItem('security_report_builder_data', JSON.stringify(parsed));

                    // Update local state
                    setEngagement({ ...engagement, status: 'Delivered' });
                    alert('Report published successfully!');
                }
            }
        }
    };

    if (!engagement || !client || !provider) {
        return <div className="p-8">Loading report...</div>;
    }

    const isClientView = router.push.toString().includes('client') || typeof window !== 'undefined' && window.location.search.includes('view=client');
    const isPublished = engagement.status === 'Completed' || engagement.status === 'Delivered';

    const currentVersion = engagement.version || 1;

    return (
        <div className="min-h-screen bg-gray-50 py-8 print:bg-white print:py-0">
            {/* Toolbar - Actions */}
            <div className="mx-auto max-w-[850px] mb-8 flex items-center justify-between px-4 print:hidden">
                <Button variant="outline" onClick={() => isClientView ? router.push('/portal/reports') : router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> {isClientView ? 'Back to Portal' : 'Back to Engagement'}
                </Button>

                {isClientView && isPublished && (
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border shadow-sm">
                        <select
                            className="bg-transparent text-sm font-medium border-none focus:ring-0 cursor-pointer"
                            value={currentVersion}
                            onChange={(e) => alert(`Viewing historical version ${e.target.value} is not fully implemented in this demo, but the record exists!`)}
                        >
                            <option value={currentVersion}>v{currentVersion}.0 (Latest)</option>
                            {Array.from({ length: currentVersion - 1 }, (_, i) => currentVersion - 1 - i).map(v => (
                                <option key={v} value={v}>v{v}.0 - Archived</option>
                            ))}
                        </select>
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-mono font-bold">
                            v{currentVersion}
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    {!isClientView && (
                        isPublished ? (
                            <div className="flex items-center gap-2">
                                <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-medium border border-green-200">
                                    Published (v{currentVersion})
                                </span>
                                <Button onClick={() => handlePublish(true)} variant="outline" size="sm" className="bg-white hover:bg-slate-50 border-blue-200 text-blue-700 hover:text-blue-800">
                                    Publish New Version
                                </Button>
                            </div>
                        ) : (
                            <Button onClick={() => handlePublish(false)} variant="default" className="bg-blue-600 hover:bg-blue-700">
                                Publish to Client
                            </Button>
                        )
                    )}
                    <Button onClick={handlePrint} variant="outline">
                        <Printer className="mr-2 h-4 w-4" /> Print / PDF
                    </Button>
                </div>
            </div>

            {/* Report Content */}
            <div className="mx-auto max-w-[850px] bg-white shadow-lg px-20 py-24 text-black print:shadow-none">
                <ReportRenderer
                    engagement={engagement}
                    client={client}
                    provider={provider}
                />
                <div className="mt-20 border-t border-gray-200 pt-8 text-center text-xs text-gray-500">
                    Generated by OkNexus • OkynusTech
                </div>
            </div>
        </div>
    );
}
