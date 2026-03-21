'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    Users,
    Shield,
    FileText,
    Settings,
    Building2,
    Folder,
    TrendingUp,
    LogOut,
    User,
    RefreshCw,
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function MainNav() {
    const pathname = usePathname();
    const { data: session } = useSession();

    // specific handling for login page or public pages if any
    if (pathname === '/login' || pathname === '/register') {
        return null;
    }

    const routes = [
        {
            href: '/',
            label: 'Dashboard',
            icon: LayoutDashboard,
            active: pathname === '/',
        },
        {
            href: '/analytics',
            label: 'Analytics',
            icon: TrendingUp,
            active: pathname.startsWith('/analytics'),
        },
        {
            href: '/clients',
            label: 'Clients',
            icon: Building2,
            active: pathname.startsWith('/clients'),
        },
        {
            href: '/applications',
            label: 'Applications',
            icon: Folder,
            active: pathname.startsWith('/applications'),
        },
        {
            href: '/engineers',
            label: 'Engineers',
            icon: Users,
            active: pathname.startsWith('/engineers'),
        },
        {
            href: '/artifacts',
            label: 'Artifacts',
            icon: FileText,
            active: pathname.startsWith('/artifacts'),
        },
        {
            href: '/templates',
            label: 'Templates',
            icon: Shield, // Using Shield as placeholder for templates/security
            active: pathname.startsWith('/templates'),
        },
        {
            href: '/retests',
            label: 'Retest Queue',
            icon: RefreshCw,
            active: pathname.startsWith('/retests'),
        },
    ];

    return (
        <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="container flex h-16 items-center px-4">
                <Link href="/" className="mr-8 flex items-center gap-2 font-bold text-xl">
                    <span className="text-foreground">
                        OkNexus
                    </span>
                </Link>

                <div className="flex items-center gap-2 lg:gap-3 overflow-x-auto no-scrollbar fade-right">
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            className={cn(
                                "flex items-center text-sm font-medium transition-colors hover:text-primary px-3 py-2 rounded-md gap-2",
                                route.active
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground"
                            )}
                        >
                            <route.icon className="h-4 w-4" />
                            {route.label}
                        </Link>
                    ))}
                </div>

                <div className="ml-auto flex items-center space-x-4">
                    {session?.user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                    <Avatar className="h-9 w-9 border border-input">
                                        {session.user.image ? (
                                            <AvatarImage src={session.user.image} alt={session.user.name || ''} />
                                        ) : null}
                                        <AvatarFallback>
                                            {session.user.name?.charAt(0) || <User className="h-4 w-4" />}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{session.user.name}</p>
                                        <p className="text-xs leading-none text-muted-foreground">
                                            {session.user.email}
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/settings" className="w-full cursor-pointer">
                                        <Settings className="mr-2 h-4 w-4" />
                                        Settings
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="cursor-pointer text-red-600 focus:text-red-600"
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Link href="/login">
                            <Button size="sm">Log In</Button>
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
