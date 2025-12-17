// Credits Service
// A modular, standalone service for managing user credits
// Plug-and-play: configure once, use anywhere

import { authenticatedFetch } from './googleAuthService';

// ==================== Configuration ====================

let CONFIG = {
    apiBaseUrl: ''
};

/**
 * Configure the Credits service
 * @param config.apiBaseUrl - Backend API base URL
 */
export function configureCreditsService(config: { apiBaseUrl: string }) {
    CONFIG.apiBaseUrl = config.apiBaseUrl;
}

// ==================== Types ====================

/**
 * Response from GET /credits
 */
export interface CreditsBalance {
    user_id: string;
    credits: number;
    last_used_at: string | null;
}

/**
 * Single credit history item (job)
 */
export interface CreditHistoryItem {
    job_id: string;
    job_type: string;
    status: string;
    credits_reserved: number;
    credits_refunded: boolean;
    error_message: string | null;
    created_at: string;
    completed_at: string | null;
}

/**
 * Response from GET /credits/history
 */
export interface CreditsHistoryResponse {
    user_id: string;
    current_balance: number;
    history: CreditHistoryItem[];
    total_count: number;
    page: number;
    limit: number;
}

/**
 * Error types for credits operations
 */
export type CreditsErrorType = 'NETWORK' | 'UNAUTHORIZED' | 'SERVER_ERROR';

/**
 * Credits API response wrapper
 */
export interface CreditsResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    errorType?: CreditsErrorType;
}

// ==================== API Methods ====================

/**
 * Get current credit balance and last usage time
 * Requires authenticated user
 */
export async function getCreditsBalance(): Promise<CreditsResponse<CreditsBalance>> {
    if (!CONFIG.apiBaseUrl) {
        return {
            success: false,
            error: 'Credits service not configured. Call configureCreditsService first.',
            errorType: 'SERVER_ERROR'
        };
    }

    try {
        const response = await authenticatedFetch(`${CONFIG.apiBaseUrl}/credits`);

        if (response.status === 401) {
            return {
                success: false,
                error: 'Authentication required. Please sign in.',
                errorType: 'UNAUTHORIZED'
            };
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Try again.' } }));
            // Handle standardized error response: { success: false, error: { code, message, details } }
            return {
                success: false,
                error: errorData.error?.message || errorData.detail || 'Try again.',
                errorType: 'SERVER_ERROR'
            };
        }

        const data: CreditsBalance = await response.json();
        return { success: true, data };
    } catch (error) {
        return {
            success: false,
            error: 'Network error. Please check your connection.',
            errorType: 'NETWORK'
        };
    }
}

/**
 * Get paginated credit usage history
 * @param page - Page number (1-indexed, default: 1)
 * @param limit - Items per page (default: 20, max: 100)
 */
export async function getCreditsHistory(
    page: number = 1,
    limit: number = 20
): Promise<CreditsResponse<CreditsHistoryResponse>> {
    if (!CONFIG.apiBaseUrl) {
        return {
            success: false,
            error: 'Credits service not configured. Call configureCreditsService first.',
            errorType: 'SERVER_ERROR'
        };
    }

    // Validate and clamp parameters
    const validPage = Math.max(1, Math.floor(page));
    const validLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    try {
        const url = `${CONFIG.apiBaseUrl}/credits/history?page=${validPage}&limit=${validLimit}`;
        const response = await authenticatedFetch(url);

        if (response.status === 401) {
            return {
                success: false,
                error: 'Authentication required. Please sign in.',
                errorType: 'UNAUTHORIZED'
            };
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Try again.' } }));
            // Handle standardized error response: { success: false, error: { code, message, details } }
            return {
                success: false,
                error: errorData.error?.message || errorData.detail || 'Try again.',
                errorType: 'SERVER_ERROR'
            };
        }

        const data: CreditsHistoryResponse = await response.json();
        return { success: true, data };
    } catch (error) {
        return {
            success: false,
            error: 'Network error. Please check your connection.',
            errorType: 'NETWORK'
        };
    }
}

// ==================== Convenience Exports ====================

/**
 * Credits service object for namespaced access
 */
export const creditsService = {
    configure: configureCreditsService,
    getBalance: getCreditsBalance,
    getHistory: getCreditsHistory
};
