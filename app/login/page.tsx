'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/hooks/use-auth';

export default function LoginPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (user) router.push('/');
    }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        if (mode === 'signin') {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                setError(error.message);
                setLoading(false);
            }
            // On success, useAuth triggers and useEffect above redirects to /
        } else {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) {
                setError(error.message);
            } else {
                setSuccess('Account created! Check your email to confirm, then sign in.');
                setMode('signin');
            }
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background">
            <div className="w-full max-w-md px-4">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <ShieldCheck className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">OkNexus</h1>
                    <p className="mt-2 text-sm font-medium text-muted-foreground">by OkynusTech</p>
                </div>

                <Card className="p-8 shadow-lg border-muted">
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-xl font-semibold text-foreground">
                                {mode === 'signin' ? 'Sign in to your account' : 'Create an account'}
                            </h2>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Secure access for authorized personnel only.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                                />
                            </div>

                            {error && (
                                <p className="text-sm text-red-500 font-medium text-center bg-red-950/30 rounded-md border border-red-900/50 px-4 py-2">
                                    {error}
                                </p>
                            )}

                            {success && (
                                <p className="text-sm text-green-400 font-medium text-center bg-green-950/30 rounded-md border border-green-900/50 px-4 py-2">
                                    {success}
                                </p>
                            )}

                            <Button type="submit" className="w-full py-5" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {mode === 'signin' ? 'Sign In' : 'Create Account'}
                            </Button>
                        </form>

                        <div className="text-center text-sm text-muted-foreground">
                            {mode === 'signin' ? (
                                <>
                                    Don&apos;t have an account?{' '}
                                    <button
                                        type="button"
                                        onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                                        className="text-primary hover:underline font-medium"
                                    >
                                        Sign up
                                    </button>
                                </>
                            ) : (
                                <>
                                    Already have an account?{' '}
                                    <button
                                        type="button"
                                        onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}
                                        className="text-primary hover:underline font-medium"
                                    >
                                        Sign in
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="text-center">
                            <a href="/portal/findings" className="text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline">
                                Demo: Access Client Portal View
                            </a>
                        </div>
                    </div>
                </Card>

                <div className="mt-8 text-center text-xs text-gray-400">
                    <p>&copy; {new Date().getFullYear()} OkynusTech. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
}
