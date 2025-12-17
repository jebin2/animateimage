// Google Authentication Service
// Handles Google Sign-In, JWT token management, and user session

import { multiSet, multiGet, multiGetSync, multiRemove } from './multiStorageService';

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

// In-memory token storage (cleared on page refresh)
let accessToken: string | null = null;

// Dynamic storage keys based on prefix
function getStorageKeys() {
    return {
        user: `${CONFIG.storagePrefix}_user`,
        avatarCache: `${CONFIG.storagePrefix}_avatar_cache`
    };
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

    // Save to all storage mechanisms and notify subscribers
    multiSet(getStorageKeys().user, updatedUser).catch(console.error);
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

            // Store access token in memory (cleared on page refresh)
            accessToken = authResponse.access_token;

            // Store user info in multi-storage (localStorage, cookie, IndexedDB)
            await multiSet(getStorageKeys().user, user);

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
            client_type: 'web'  // Request HttpOnly cookie for refresh token
        }),
        credentials: 'include'  // Important: Send/receive cookies
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
        theme: 'outline',
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
    const token = accessToken;

    // Clear access token from memory
    accessToken = null;

    // Clear user info from all storage mechanisms
    await multiRemove(getStorageKeys().user);

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

    // Call server logout to clear HttpOnly cookie
    try {
        if (token) {
            await fetch(`${CONFIG.apiBaseUrl}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'  // Important: Send cookies
            });
        }
    } catch (e) {
        // Ignore errors on logout
    }

    notifyAuthStateChange(null);

    // Re-initialize Google Auth for future sign-ins
    // This is needed because revoke() invalidates the session
    try {
        await initGoogleAuth();
    } catch (e) {
        console.error('Failed to re-initialize Google Auth after sign out:', e);
    }
}

/**
 * Get stored access token (from memory)
 */
export function getAccessToken(): string | null {
    return accessToken;
}

/**
 * Get current user from storage (sync - tries localStorage first, then cookie)
 */
function getCurrentUserSync(): GoogleUser | null {
    const userStr = multiGetSync(getStorageKeys().user);
    if (!userStr) return null;

    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

/**
 * Get current user from storage (async - checks all storage mechanisms)
 */
export async function getCurrentUser(): Promise<GoogleUser | null> {
    const userStr = await multiGet(getStorageKeys().user);
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
    const token = accessToken;
    const user = getCurrentUserSync();
    return !!(token && user);
}

/**
 * Refresh the access token using HttpOnly cookie
 */
export async function refreshToken(): Promise<boolean> {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({}),  // Empty body - refresh token comes from HttpOnly cookie
            credentials: 'include'  // Important: Send HttpOnly cookie
        });

        if (!response.ok) {
            // Refresh token invalid or expired, sign out
            await signOut();
            return false;
        }

        const data = await response.json();
        if (data.success && data.access_token) {
            // Update access token in memory
            accessToken = data.access_token;
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
    const token = getAccessToken();
    if (!token) return null;

    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include'
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

        // Update stored user in all storage mechanisms
        await multiSet(getStorageKeys().user, user);
        notifyAuthStateChange(user);

        return user;
    } catch (error) {
        console.error('Failed to fetch user info:', error);
        return null;
    }
}

/**
 * Initialize auth and restore session if available
 * This proactively tries to refresh from HttpOnly cookie on page load
 */
export async function initializeAuth(): Promise<GoogleUser | null> {
    // If we already have a token in memory, verify it's still valid
    if (accessToken) {
        const freshUser = await fetchUserInfo();
        if (freshUser) {
            return freshUser;
        }
    }

    // Check if user has ever signed in before (stored user in localStorage)
    if (!getCurrentUserSync()) {
        try {
            await initGoogleAuth();
        } catch (error) {
            console.error('Failed to initialize Google Auth:', error);
        }
        return null;
    }

    // Try to restore session from HttpOnly cookie (Step 2 from server guide)
    try {
        const refreshed = await refreshToken();
        if (refreshed) {
            // Successfully restored session, fetch user info
            const user = await fetchUserInfo();
            if (user) {
                return user;
            }
        }
    } catch (error) { }

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
    const token = getAccessToken();

    const headers = new Headers(options.headers);
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include'  // Important: Send/receive cookies
    });

    // Handle 401 by refreshing token and retrying
    if (response.status === 401 && token) {
        const refreshed = await refreshToken();
        if (refreshed) {
            const newToken = getAccessToken();
            headers.set('Authorization', `Bearer ${newToken}`);
            return fetch(url, { ...options, headers, credentials: 'include' });
        }
        // Refresh failed, sign out
        await signOut();
    }

    return response;
}
