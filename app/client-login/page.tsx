'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Shield, ArrowRight, Loader2 } from 'lucide-react';
import { getClientUserByEmail } from '@/lib/storage';

export default function ClientLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Verify credentials against local storage (Simulation)
            // In a real app, this happens server-side. Here we verify existence 
            // and then pass a "trusted" token to the server.
            const user = getClientUserByEmail(email.trim());

            if (!user) {
                console.error('User not found in localStorage', email);
                throw new Error('User not found. NOTE: Do not use Incognito/Private windows as they cannot see data created in the main window (Demo Limitation).');
            }

            // Simple password check (DEMO ONLY)
            // In production, bcrypt compare happens on server.
            // We set default password to 'password123' in the invite dialog.
            const cleanPassword = password.trim();
            if (cleanPassword !== 'password123' && cleanPassword !== user.passwordHash) {
                throw new Error('Invalid password');
            }

            // 2. Sign in via NextAuth using the "Magic Prefix" protocol
            // format: client::email::name::clientId::role::id
            const magicToken = `client::${user.email}::${user.name}::${user.clientId}::${user.role}::${user.id}`;

            const result = await signIn('credentials', {
                username: magicToken,
                password: 'password123', // Dummy password to pass checks
                redirect: false,
            });

            if (result?.error) {
                throw new Error('Authentication failed');
            }

            // 3. Redirect to Portal
            router.push('/portal');
            router.refresh();

        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-900/50">
                        <Shield className="h-6 w-6 text-blue-400" />
                    </div>
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">
                        Client Portal
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Secure access to your security assessments and reports.
                    </p>
                </div>

                <Card className="border-slate-800 bg-slate-900/50 p-8">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div className="space-y-2">
                            <Label className="text-slate-200">Email Address</Label>
                            <Input
                                type="email"
                                placeholder="name@company.com"
                                className="bg-slate-950 border-slate-800 text-slate-200"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-200">Password</Label>
                            </div>
                            <Input
                                type="password"
                                className="bg-slate-950 border-slate-800 text-slate-200"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-sm text-red-500 font-medium text-center whitespace-pre-wrap px-4 py-2 bg-red-950/30 rounded-md border border-red-900/50">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <ArrowRight className="mr-2 h-4 w-4" />
                            )}
                            Sign in to Portal
                        </Button>
                    </form>
                </Card>

                <div className="text-center text-xs text-slate-500">
                    <p>Protected by OkNexus Security Intelligence.</p>
                </div>
            </div>
        </div>
    );
}
