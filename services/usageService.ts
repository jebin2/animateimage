// Usage service for user analytics with RSA encryption
// Uses IndexedDB for persistent storage and RSA-OAEP for encryption

const DB_NAME = 'animateimage';
const DB_VERSION = 1;

// RSA Public Key for encryption (private key kept on server)
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkmiMIW3fkXUnKjhAthrq
4G0esmDh0un0DJoPAqiji+rA0suGMq0pJwFOJWA5zLNk/Ial9+16PkswIxOaIpU/
2yoX1WhFblU3YwfuGwxcfgHDFRZ1CGDWoEHZ7+Q8CHeW3N4Jt1YOPXXx9WeNFQQs
65CX7FU9XBrh++2gx+CObGi+iGSmK1+d6hPnNIClmxzXtW9qEBUo7JP6qfWFPjYx
CPjW8Rgmmz1luyAROfe3PKbBDG/doHTJK+Wxq8FQMkQthmWwEQsHB8MMzN/CLQwC
9Ux3JDj8lVx37PvZs3bUTwHkQ5QZhgycaMa9afghcG67vey2rDYxq4undL0dN4XT
LQIDAQAB
-----END PUBLIC KEY-----`;

interface UsageEvent {
    type: 'generate_click' | 'generate_success' | 'generate_failure';
    mode: 'animate' | 'edit';
    timestamp: string;
}

interface UsageData {
    userId: string;
    events: UsageEvent[];
}

let db: IDBDatabase | null = null;
let userId: string | null = null;

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

// Convert PEM to CryptoKey
async function importPublicKey(): Promise<CryptoKey> {
    const pemContents = PUBLIC_KEY_PEM
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\s/g, '');

    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    return await crypto.subtle.importKey(
        'spki',
        binaryDer.buffer,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
    );
}

// Encrypt data with RSA-OAEP (for small payloads, we use hybrid encryption)
async function encryptData(data: string): Promise<string> {
    const publicKey = await importPublicKey();
    const encoder = new TextEncoder();

    // RSA can only encrypt small amounts of data, so we encrypt in chunks if needed
    // For simplicity, we'll limit to reasonable event sizes
    const dataBytes = encoder.encode(data);

    // If data is too large for RSA (max ~190 bytes for 2048-bit key with OAEP-SHA256)
    // We'll use hybrid encryption with AES
    if (dataBytes.length > 190) {
        // Generate random AES key
        const aesKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt']
        );

        // Encrypt data with AES
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            dataBytes
        );

        // Export and encrypt AES key with RSA
        const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
        const encryptedAesKey = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            publicKey,
            rawAesKey
        );

        // Combine: encryptedKey (256 bytes) + iv (12 bytes) + encryptedData
        const combined = {
            type: 'hybrid',
            key: btoa(String.fromCharCode(...new Uint8Array(encryptedAesKey))),
            iv: btoa(String.fromCharCode(...iv)),
            data: btoa(String.fromCharCode(...new Uint8Array(encryptedData)))
        };

        return btoa(JSON.stringify(combined));
    } else {
        // Direct RSA encryption for small data
        const encrypted = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            publicKey,
            dataBytes
        );

        const combined = {
            type: 'direct',
            data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
        };

        return btoa(JSON.stringify(combined));
    }
}

// Open IndexedDB
function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            if (!database.objectStoreNames.contains('user')) {
                database.createObjectStore('user', { keyPath: 'id' });
            }

            if (!database.objectStoreNames.contains('events')) {
                database.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// Get or create user ID
async function getOrCreateUserId(): Promise<string> {
    if (userId) return userId;

    const database = await openDatabase();
    db = database;

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['user'], 'readwrite');
        const store = transaction.objectStore('user');
        const getRequest = store.get('primary');

        getRequest.onsuccess = () => {
            if (getRequest.result) {
                userId = getRequest.result.value;
                resolve(userId!);
            } else {
                const newId = generateUserId();
                store.put({ id: 'primary', value: newId });
                userId = newId;
                resolve(newId);
            }
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
}

// Record a usage event
export async function recordUsage(type: 'generate_click' | 'generate_success' | 'generate_failure', mode: 'animate' | 'edit'): Promise<void> {
    try {
        const currentUserId = await getOrCreateUserId();

        const event: UsageEvent = {
            type,
            mode,
            timestamp: new Date().toISOString()
        };

        const dataToEncrypt: UsageData = {
            userId: currentUserId,
            events: [event]
        };

        const encryptedData = await encryptData(JSON.stringify(dataToEncrypt));

        if (!db) db = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db!.transaction(['events'], 'readwrite');
            const store = transaction.objectStore('events');
            const request = store.add({ data: encryptedData, timestamp: Date.now() });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            transaction.onerror = () => reject(transaction.error);
        });

    } catch (error) {
        // Fail silently - don't interrupt user experience
    }
}

// Get all encrypted data for sending to server
export async function getEncryptedData(): Promise<string[]> {
    if (!db) db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db!.transaction(['events'], 'readonly');
        const store = transaction.objectStore('events');
        const request = store.getAll();

        request.onsuccess = () => {
            const events = request.result.map((item: { data: string }) => item.data);
            resolve(events);
        };

        request.onerror = () => reject(request.error);
    });
}

// Clear all events after sync
async function clearEvents(): Promise<void> {
    if (!db) db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db!.transaction(['events'], 'readwrite');
        const store = transaction.objectStore('events');
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Sync usage data to server
async function syncUsageToServer(): Promise<void> {
    try {
        const currentUserId = userId || await getOrCreateUserId();
        const events = await getEncryptedData();

        if (events.length === 0) return;

        // Concatenate all encrypted events
        const encryptedData = events.join('|');

        // Send to server (fire and forget)
        const url = `https://jebin2-apigateway.hf.space?userid=${currentUserId}${encryptedData}`;
        fetch(url, { method: 'GET', mode: 'no-cors' }).catch(() => { });

        // Clear events after sending
        await clearEvents();
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

// Get user ID (for display/debug purposes)
export function getUserId(): string | null {
    return userId;
}

