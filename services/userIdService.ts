// User ID service with IndexedDB and Cookie backup
// Provides persistent user identification across sessions

const COOKIE_NAME = 'animateimage_userid';
const COOKIE_EXPIRY_DAYS = 365;

let cachedUserId: string | null = null;

// Generate a 20-character alphanumeric ID
function generateUserId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(20);
    crypto.getRandomValues(array);
    for (let i = 0; i < 20; i++) {
        result += chars[array[i] % chars.length];
    }
    return result;
}

// Cookie operations
function setCookie(value: string): void {
    const date = new Date();
    date.setTime(date.getTime() + (COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${COOKIE_NAME}=${value};${expires};path=/;SameSite=Lax`;
}

function getCookie(): string | null {
    const name = `${COOKIE_NAME}=`;
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookies = decodedCookie.split(';');
    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.indexOf(name) === 0) {
            return cookie.substring(name.length);
        }
    }
    return null;
}

// IndexedDB operations
const DB_NAME = 'animateimage_user';
const DB_VERSION = 2;

function openUserDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;
            if (database.objectStoreNames.contains('user')) {
                database.deleteObjectStore('user');
            }
            database.createObjectStore('user');
        };
    });
}

async function getIdFromIndexedDB(): Promise<string | null> {
    try {
        const db = await openUserDatabase();
        return new Promise((resolve) => {
            const transaction = db.transaction(['user'], 'readonly');
            const store = transaction.objectStore('user');
            const request = store.get('user_id');

            request.onsuccess = () => {
                resolve(request.result as string || null);
            };
            request.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function saveIdToIndexedDB(userId: string): Promise<void> {
    try {
        const db = await openUserDatabase();
        return new Promise((resolve) => {
            const transaction = db.transaction(['user'], 'readwrite');
            const store = transaction.objectStore('user');
            store.put(userId, 'user_id');
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
        });
    } catch {
        // Fail silently
    }
}

// Get or create user ID with cookie backup
export async function getOrCreateUserId(): Promise<string> {
    // Return cached if available
    if (cachedUserId) return cachedUserId;

    // Try IndexedDB first
    let userId = await getIdFromIndexedDB();

    // If not in IndexedDB, check cookie
    if (!userId) {
        userId = getCookie();
        // If found in cookie, restore to IndexedDB
        if (userId) {
            await saveIdToIndexedDB(userId);
        }
    }

    // If still no ID, generate new one
    if (!userId) {
        userId = generateUserId();
        await saveIdToIndexedDB(userId);
        setCookie(userId);
    } else {
        // Ensure cookie is set (in case it was only in IndexedDB)
        setCookie(userId);
    }

    cachedUserId = userId;
    return userId;
}

// Get cached user ID (returns null if not initialized)
export function getUserId(): string | null {
    return cachedUserId;
}

// Force refresh user ID from storage
export async function refreshUserId(): Promise<string> {
    cachedUserId = null;
    return getOrCreateUserId();
}

// Update user ID manually (e.g. from secret key recovery)
export async function updateUserId(newUserId: string): Promise<void> {
    cachedUserId = newUserId;
    setCookie(newUserId);
    await saveIdToIndexedDB(newUserId);
}



// Credits Management
export async function saveCredits(credits: number): Promise<void> {
    try {
        const db = await openUserDatabase();
        const transaction = db.transaction(['user'], 'readwrite');
        const store = transaction.objectStore('user');
        store.put(credits, 'credits');
    } catch { /* silent fail */ }
}

export async function getCredits(): Promise<number | null> {
    try {
        const db = await openUserDatabase();
        return new Promise((resolve) => {
            const transaction = db.transaction(['user'], 'readonly');
            const store = transaction.objectStore('user');
            const request = store.get('credits');
            request.onsuccess = () => resolve(request.result as number || null);
            request.onerror = () => resolve(null);
        });
    } catch { return null; }
}
