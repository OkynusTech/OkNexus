import { supabase } from './supabase-client';
import type { AppState } from './types';

// Load app state for a user from Supabase
export async function loadStateFromDB(userEmail: string): Promise<AppState | null> {
    const { data, error } = await supabase
        .from('app_state')
        .select('data')
        .eq('user_email', userEmail)
        .single();

    if (error || !data) return null;
    return data.data as AppState;
}

// Upsert app state for a user into Supabase
export async function saveStateToDB(userEmail: string, state: AppState): Promise<void> {
    const { error } = await supabase
        .from('app_state')
        .upsert({ user_email: userEmail, data: state, updated_at: new Date().toISOString() });

    if (error) {
        console.error('[db-sync] Failed to save state to Supabase:', error.message);
    }
}

// Debounced sync — avoids hammering Supabase on rapid successive saves
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function queueDBSync(userEmail: string | undefined, state: AppState): void {
    if (!userEmail) return;

    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
        saveStateToDB(userEmail, state).catch(err =>
            console.error('[db-sync] Background sync error:', err)
        );
    }, 1500);
}
