'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { loadStateFromDB, saveStateToDB } from '@/lib/db-sync';
import { loadState, saveState } from '@/lib/storage';

declare global {
    interface Window {
        __dbSyncEmail?: string;
    }
}

export default function StateHydrator() {
    const { user } = useAuth();
    const userEmail = user?.email;

    useEffect(() => {
        if (!userEmail) return;

        // Expose email globally so saveState() can queue syncs
        window.__dbSyncEmail = userEmail;

        (async () => {
            const dbState = await loadStateFromDB(userEmail);

            if (dbState) {
                // DB has data — overwrite localStorage with the authoritative server copy
                saveState(dbState);
            } else {
                // First time this user hits the DB — push whatever is in localStorage up
                const localState = loadState();
                const hasLocalData =
                    localState.clients.length > 0 ||
                    localState.engagements.length > 0 ||
                    localState.serviceProviders.length > 0;

                if (hasLocalData) {
                    await saveStateToDB(userEmail, localState);
                }
            }
        })();
    }, [userEmail]);

    return null;
}
