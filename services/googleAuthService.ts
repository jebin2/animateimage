// Google Authentication Service
// Handles Google Sign-In, JWT token management, and user session

// TypeScript declarations for Google Identity Services
declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: GoogleIdConfig) => void;
                    prompt: (callback?: (notification: PromptNotification) => void) => void;
                    renderButton: (element: HTMLElement, config: GoogleButtonConfig) => void;
                    revoke: (email: string, callback: () => void) => void;
                    disableAutoSelect: () => void;
                };
            };
        };
    }
}

interface GoogleIdConfig {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
}

interface GoogleCredentialResponse {
    credential: string;
    select_by?: string;
}

interface PromptNotification {
    isNotDisplayed: () => boolean;
    isSkippedMoment: () => boolean;
    isDismissedMoment: () => boolean;
    getNotDisplayedReason: () => string;
    getSkippedReason: () => string;
    getDismissedReason: () => string;
}

interface GoogleButtonConfig {
    type?: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    logo_alignment?: 'left' | 'center';
    width?: number;
}

// User info interface
export interface GoogleUser {
    userId: string;
    email: string;
    name?: string | null;
    profilePicture?: string | null;
    credits: number;
    isNewUser: boolean;
}

// Auth response from server
interface AuthApiResponse {
    success: boolean;
    access_token: string;
    user_id: string;
    email: string;
    name?: string | null;
    credits: number;
    is_new_user: boolean;
}

interface UserInfoResponse {
    user_id: string;
    email: string;
    name?: string | null;
    credits: number;
    profile_picture?: string | null;
}

// Configuration
let CONFIG = {
    clientId: '',
    apiBaseUrl: '',
    storagePrefix: 'auth' // Prefix for all storage keys
};

// Dynamic storage keys based on prefix
function getStorageKeys() {
    return {
        accessToken: `${CONFIG.storagePrefix}_access_token`,
        user: `${CONFIG.storagePrefix}_user`,
        tokenExpiry: `${CONFIG.storagePrefix}_token_expiry`,
        avatarCache: `${CONFIG.storagePrefix}_avatar_cache`
    };
}

// IndexedDB configuration (uses storage prefix)
function getDbName() {
    return `${CONFIG.storagePrefix}_db`;
}
const DB_VERSION = 1;
const STORE_NAME = 'auth';

// Cookie expiry (30 days)
const COOKIE_EXPIRY_DAYS = 30;

// Token expiry time (23 hours - refresh before 24h expiry)
const TOKEN_REFRESH_THRESHOLD_MS = 23 * 60 * 60 * 1000;

// ==================== Cookie Helpers ====================

function setCookie(key: string, value: string): void {
    const date = new Date();
    date.setTime(date.getTime() + (COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${key}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax`;
}

function getCookie(key: string): string | null {
    const name = `${key}=`;
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

function deleteCookie(key: string): void {
    document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

// ==================== IndexedDB Helpers ====================

function openAuthDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(getDbName(), DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

async function setIndexedDB(key: string, value: string): Promise<void> {
    try {
        const db = await openAuthDatabase();
        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.put(value, key);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve(); // Fail silently
        });
    } catch {
        // Fail silently
    }
}

async function getIndexedDB(key: string): Promise<string | null> {
    try {
        const db = await openAuthDatabase();
        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result as string || null);
            request.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function deleteIndexedDB(key: string): Promise<void> {
    try {
        const db = await openAuthDatabase();
        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.delete(key);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
        });
    } catch {
        // Fail silently
    }
}

// ==================== Multi-layer Storage ====================

async function saveToAllStorages(key: string, value: string): Promise<void> {
    // Save to localStorage (primary)
    localStorage.setItem(key, value);
    // Save to cookie (backup)
    setCookie(key, value);
    // Save to IndexedDB (failsafe)
    await setIndexedDB(key, value);
}

async function getFromStorages(key: string): Promise<string | null> {
    // Try localStorage first (fastest)
    let value = localStorage.getItem(key);
    if (value) return value;

    // Try cookie (backup)
    value = getCookie(key);
    if (value) {
        // Restore to localStorage
        localStorage.setItem(key, value);
        return value;
    }

    // Try IndexedDB (failsafe)
    value = await getIndexedDB(key);
    if (value) {
        // Restore to localStorage and cookie
        localStorage.setItem(key, value);
        setCookie(key, value);
        return value;
    }

    return null;
}

async function clearFromAllStorages(key: string): Promise<void> {
    localStorage.removeItem(key);
    deleteCookie(key);
    await deleteIndexedDB(key);
}

async function clearAllAuthStorage(): Promise<void> {
    await clearFromAllStorages(getStorageKeys().accessToken);
    await clearFromAllStorages(getStorageKeys().user);
    await clearFromAllStorages(getStorageKeys().tokenExpiry);
}

// Event callbacks
type AuthCallback = (user: GoogleUser | null) => void;
let authStateCallbacks: AuthCallback[] = [];

/**
 * Configure the Google Auth service
 * @param config.clientId - Google OAuth Client ID
 * @param config.apiBaseUrl - Backend API base URL
 * @param config.storagePrefix - Prefix for all storage keys (default: 'auth')
 */
export function configureGoogleAuth(config: {
    clientId: string;
    apiBaseUrl: string;
    storagePrefix?: string;
}) {
    CONFIG.clientId = config.clientId;
    CONFIG.apiBaseUrl = config.apiBaseUrl;
    if (config.storagePrefix) {
        CONFIG.storagePrefix = config.storagePrefix;
    }
}

/**
 * Get the avatar cache key (for UserAvatar component)
 */
export function getAvatarCacheKey(): string {
    return getStorageKeys().avatarCache;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback: AuthCallback): () => void {
    authStateCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
        authStateCallbacks = authStateCallbacks.filter(cb => cb !== callback);
    };
}

/**
 * Notify all subscribers of auth state change
 */
function notifyAuthStateChange(user: GoogleUser | null) {
    authStateCallbacks.forEach(cb => cb(user));
}

/**
 * Update user credits from API response (avoids extra API call)
 * Call this when you receive credits_remaining from job APIs
 */
export async function updateUserCredits(newCredits: number): Promise<void> {
    const user = getCurrentUserSync();
    if (!user) return;

    // Update the credit value
    const updatedUser: GoogleUser = {
        ...user,
        credits: newCredits
    };

    // Save to all storage layers and notify subscribers
    await saveToAllStorages(getStorageKeys().user, JSON.stringify(updatedUser));
    notifyAuthStateChange(updatedUser);
}

/**
 * Initialize Google Sign-In library
 */
export function initGoogleAuth(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!CONFIG.clientId) {
            reject(new Error('Google Client ID not configured. Call configureGoogleAuth first.'));
            return;
        }

        // Wait for Google Identity Services to load
        const checkGoogleLoaded = () => {
            if (window.google?.accounts?.id) {
                window.google.accounts.id.initialize({
                    client_id: CONFIG.clientId,
                    callback: handleGoogleCredentialResponse,
                    auto_select: false,
                    cancel_on_tap_outside: true
                });
                resolve();
            } else {
                setTimeout(checkGoogleLoaded, 100);
            }
        };

        checkGoogleLoaded();

        // Timeout after 10 seconds
        setTimeout(() => {
            reject(new Error('Google Identity Services failed to load'));
        }, 10000);
    });
}

/**
 * Handle the credential response from Google
 */
async function handleGoogleCredentialResponse(response: GoogleCredentialResponse) {
    try {
        const authResponse = await authenticateWithServer(response.credential);
        if (authResponse.success) {
            const user: GoogleUser = {
                userId: authResponse.user_id,
                email: authResponse.email,
                name: authResponse.name,
                credits: authResponse.credits,
                isNewUser: authResponse.is_new_user
            };

            // Calculate token expiry (24 hours from now)
            const expiryTime = Date.now() + 24 * 60 * 60 * 1000;

            // Store auth data to all storage layers
            await saveToAllStorages(getStorageKeys().accessToken, authResponse.access_token);
            await saveToAllStorages(getStorageKeys().user, JSON.stringify(user));
            await saveToAllStorages(getStorageKeys().tokenExpiry, expiryTime.toString());

            notifyAuthStateChange(user);
        }
    } catch (error) {
        console.error('Google authentication failed:', error);
        notifyAuthStateChange(null);
    }
}

/**
 * Send Google ID token to server for authentication
 */
async function authenticateWithServer(idToken: string): Promise<AuthApiResponse> {
    const response = await fetch(`${CONFIG.apiBaseUrl}/auth/google`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id_token: idToken,
            temp_user_id: null
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Authentication failed' }));
        throw new Error(error.detail || 'Authentication failed');
    }

    return response.json();
}

/**
 * Trigger Google Sign-In popup
 */
export function signInWithGoogle(): void {
    if (!window.google?.accounts?.id) {
        console.error('Google Identity Services not loaded');
        return;
    }

    // Try One Tap first
    window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // One Tap not shown, user needs to click the button
            console.log('One Tap not displayed:', notification.getNotDisplayedReason?.() || notification.getSkippedReason?.());
        }
    });
}

/**
 * Render Google Sign-In button in a container
 */
export function renderGoogleButton(container: HTMLElement, config?: Partial<GoogleButtonConfig>): void {
    if (!window.google?.accounts?.id) {
        console.error('Google Identity Services not loaded');
        return;
    }

    window.google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        ...config
    });
}

/**
 * Sign out and clear session
 */
export async function signOut(): Promise<void> {
    const user = getCurrentUserSync();
    const token = getAccessTokenSync();

    // Clear all stored auth data from all storage layers
    await clearAllAuthStorage();

    // Disable auto-select for future
    if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect();

        // Revoke if we have user email
        if (user?.email) {
            window.google.accounts.id.revoke(user.email, () => {
                console.log('Google session revoked');
            });
        }
    }

    // Notify server (fire and forget)
    try {
        if (token) {
            await fetch(`${CONFIG.apiBaseUrl}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
    } catch (e) {
        // Ignore errors on logout
    }

    notifyAuthStateChange(null);
}

/**
 * Get stored access token (sync - from localStorage only)
 */
function getAccessTokenSync(): string | null {
    return localStorage.getItem(getStorageKeys().accessToken);
}

/**
 * Get stored access token (with failsafe fallback)
 */
export async function getAccessToken(): Promise<string | null> {
    return await getFromStorages(getStorageKeys().accessToken);
}

/**
 * Get current user from storage (sync - from localStorage only)
 */
function getCurrentUserSync(): GoogleUser | null {
    const userStr = localStorage.getItem(getStorageKeys().user);
    if (!userStr) return null;

    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

/**
 * Get current user from storage (with failsafe fallback)
 */
export async function getCurrentUser(): Promise<GoogleUser | null> {
    const userStr = await getFromStorages(getStorageKeys().user);
    if (!userStr) return null;

    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

/**
 * Check if user is authenticated (sync check)
 */
export function isAuthenticated(): boolean {
    const token = getAccessTokenSync();
    const user = getCurrentUserSync();
    return !!(token && user);
}

/**
 * Check if token needs refresh
 */
async function shouldRefreshToken(): Promise<boolean> {
    const expiryStr = await getFromStorages(getStorageKeys().tokenExpiry);
    if (!expiryStr) return false;

    const expiry = parseInt(expiryStr, 10);
    const timeUntilExpiry = expiry - Date.now();

    return timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS && timeUntilExpiry > 0;
}

/**
 * Refresh the access token
 */
export async function refreshToken(): Promise<boolean> {
    const currentToken = await getAccessToken();
    if (!currentToken) return false;

    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: currentToken })
        });

        if (!response.ok) {
            // Token invalid, sign out
            await signOut();
            return false;
        }

        const data = await response.json();
        if (data.success && data.access_token) {
            await saveToAllStorages(getStorageKeys().accessToken, data.access_token);
            await saveToAllStorages(getStorageKeys().tokenExpiry, (Date.now() + 24 * 60 * 60 * 1000).toString());
            return true;
        }

        return false;
    } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
    }
}

/**
 * Fetch current user info from server (refreshes credits, etc.)
 */
export async function fetchUserInfo(): Promise<GoogleUser | null> {
    const token = await getAccessToken();
    if (!token) return null;

    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token expired or invalid
                await signOut();
            }
            return null;
        }

        const data: UserInfoResponse = await response.json();
        const user: GoogleUser = {
            userId: data.user_id,
            email: data.email,
            name: data.name,
            profilePicture: data.profile_picture,
            credits: data.credits,
            isNewUser: false
        };

        // Update stored user across all storages
        await saveToAllStorages(getStorageKeys().user, JSON.stringify(user));
        notifyAuthStateChange(user);

        return user;
    } catch (error) {
        console.error('Failed to fetch user info:', error);
        return null;
    }
}

/**
 * Initialize auth and restore session if available
 */
export async function initializeAuth(): Promise<GoogleUser | null> {
    // First, try to restore from storage (with failsafe)
    const storedUser = await getCurrentUser();
    const token = await getAccessToken();

    if (storedUser && token) {
        // Check if token needs refresh
        if (await shouldRefreshToken()) {
            await refreshToken();
        }

        // Fetch fresh user info
        const freshUser = await fetchUserInfo();
        if (freshUser) {
            return freshUser;
        }
    }

    // Initialize Google Sign-In for future sign-ins
    try {
        await initGoogleAuth();
    } catch (error) {
        console.error('Failed to initialize Google Auth:', error);
    }

    return null;
}

/**
 * Make an authenticated API request
 */
export async function authenticatedFetch(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = await getAccessToken();

    const headers = new Headers(options.headers);
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    // Handle 401 by refreshing token and retrying
    if (response.status === 401 && token) {
        const refreshed = await refreshToken();
        if (refreshed) {
            const newToken = await getAccessToken();
            headers.set('Authorization', `Bearer ${newToken}`);
            return fetch(url, { ...options, headers });
        }
        // Refresh failed, sign out
        await signOut();
    }

    return response;
}
