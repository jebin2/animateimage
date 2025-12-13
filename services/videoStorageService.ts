// Video Storage Service (IndexedDB)
// Manages client-side storage of generated videos

import { authenticatedFetch } from './googleAuthService';

// ==================== Configuration ====================

const DB_NAME = 'animateimage_videos';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

let CONFIG = {
    apiBaseUrl: ''
};

export function configureVideoStorageService(config: { apiBaseUrl: string }) {
    CONFIG.apiBaseUrl = config.apiBaseUrl;
}

// ==================== Types ====================

export interface StoredVideo {
    jobId: string;
    blob: Blob;
    createdAt: string;
}

// ==================== IndexedDB Helpers ====================

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'jobId' });
            }
        };
    });
}

// ==================== Public API ====================

/**
 * Download and store a video for a job
 */
export async function downloadAndStoreVideo(jobId: string): Promise<void> {
    if (!CONFIG.apiBaseUrl) {
        throw new Error('Video Storage service not configured');
    }

    // 1. Download video
    const url = `${CONFIG.apiBaseUrl}/gemini/download/${jobId}`;
    const response = await authenticatedFetch(url);

    if (response.status === 410) {
        throw new Error('Video expired. Please generate again.');
    }

    if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const blob = await response.blob();

    // 2. Store in IndexedDB
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const video: StoredVideo = {
            jobId,
            blob,
            createdAt: new Date().toISOString()
        };

        const request = store.put(video);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

/**
 * Get a video URL from storage
 * Returns a blob URL that should be revoked when no longer needed
 */
export async function getVideoUrl(jobId: string): Promise<string | null> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(jobId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const record = request.result as StoredVideo | undefined;
                if (record) {
                    resolve(URL.createObjectURL(record.blob));
                } else {
                    resolve(null);
                }
            };
        });
    } catch (error) {
        console.error('Error getting video from DB:', error);
        return null;
    }
}

/**
 * Check if a video exists in storage
 */
export async function hasVideo(jobId: string): Promise<boolean> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.count(jobId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result > 0);
        });
    } catch (error) {
        return false;
    }
}

/**
 * Delete a video from storage
 */
export async function deleteVideo(jobId: string): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(jobId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.error('Error deleting video from DB:', error);
    }
}

export const videoStorageService = {
    configure: configureVideoStorageService,
    downloadAndStore: downloadAndStoreVideo,
    getVideoUrl,
    hasVideo,
    deleteVideo
};
