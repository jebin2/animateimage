// Event storage service using IndexedDB
// Handles encrypted event persistence and retrieval

const DB_NAME = 'animateimage_events';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

// Open IndexedDB for events
async function openEventDatabase(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;
            if (!database.objectStoreNames.contains('events')) {
                database.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// Store an encrypted event
export async function storeEvent(encryptedData: string): Promise<void> {
    const database = await openEventDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['events'], 'readwrite');
        const store = transaction.objectStore('events');
        const request = store.add(encryptedData);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
    });
}

// Get all stored encrypted events
export async function getAllEvents(): Promise<string[]> {
    const database = await openEventDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['events'], 'readonly');
        const store = transaction.objectStore('events');
        const request = store.getAll();

        request.onsuccess = () => {
            const events = request.result;
            resolve(events);
        };

        request.onerror = () => reject(request.error);
    });
}

// Clear all stored events
export async function clearAllEvents(): Promise<void> {
    const database = await openEventDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['events'], 'readwrite');
        const store = transaction.objectStore('events');
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Get event count
export async function getEventCount(): Promise<number> {
    const database = await openEventDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['events'], 'readonly');
        const store = transaction.objectStore('events');
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
