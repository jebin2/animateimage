// Usage service for user analytics
// Orchestrates user ID, event storage, and encryption services

import { encryptData } from './encryptionService';
import { getOrCreateUserId, getUserId } from './userIdService';
import { storeEvent, getAllEvents, clearAllEvents } from './eventService';
import { getAccessToken } from './googleAuthService';

interface UsageEvent {
    type: 'generate_click' | 'generate_success' | 'generate_failure';
    mode: 'animate' | 'edit';
    timestamp: string;
    website_url: string;
}

interface UsageData {
    userId: string;
    events: UsageEvent[];
}

// Record a usage event
export async function recordUsage(type: 'generate_click' | 'generate_success' | 'generate_failure', mode: 'animate' | 'edit'): Promise<void> {
    try {
        const currentUserId = await getOrCreateUserId();

        const event: UsageEvent = {
            type,
            mode,
            timestamp: new Date().toISOString(),
            website_url: window.location.href
        };

        const dataToEncrypt: UsageData = {
            userId: currentUserId,
            events: [event]
        };

        const encryptedData = await encryptData(JSON.stringify(dataToEncrypt));
        await storeEvent(encryptedData);

    } catch {
        // Fail silently - don't interrupt user experience
    }
}

// Get all encrypted data for sending to server
export async function getEncryptedData(): Promise<string[]> {
    return getAllEvents();
}


let SYNC_URL = 'https://jebin2-apigateway.hf.space/blink';
export function configureUsageService(config: { syncUrl: string }) {
    SYNC_URL = config.syncUrl;
}

// Sync usage data to server
async function syncUsageToServer(): Promise<void> {
    try {
        const currentUserId = await getOrCreateUserId();
        const events = await getAllEvents();

        if (events.length === 0) return;

        // Concatenate all encrypted events
        const encryptedData = events.join(',');

        // Send to server (fire and forget)
        const url = `${SYNC_URL}?userid=${currentUserId}${encryptedData}`;

        // Check if user is authenticated and add auth header if available
        const accessToken = await getAccessToken();

        if (accessToken) {
            // Authenticated request with CORS mode
            fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }).catch(() => { });
        } else {
            // Unauthenticated request with no-cors mode
            fetch(url, { method: 'GET', mode: 'no-cors' }).catch(() => { });
        }

        // Clear events after sending
        await clearAllEvents();
    } catch {
        // Fail silently
    }
}

// Initialize usage on app load
export async function initUsage(): Promise<string> {
    const id = await getOrCreateUserId();

    // Sync existing data to server
    syncUsageToServer();

    return id;
}

// Re-export getUserId for convenience
export { getUserId } from './userIdService';
