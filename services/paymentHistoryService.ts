// Payment History Service
// A modular, standalone service for fetching payment transaction history
// Plug-and-play: configure once, use anywhere

import { authenticatedFetch } from './googleAuthService';

// ==================== Configuration ====================

let CONFIG = {
    apiBaseUrl: ''
};

/**
 * Configure the Payment History service
 * @param config.apiBaseUrl - Backend API base URL
 */
export function configurePaymentHistoryService(config: { apiBaseUrl: string }) {
    CONFIG.apiBaseUrl = config.apiBaseUrl;
}

// ==================== Types ====================

/**
 * Payment status values
 */
export type PaymentStatus = 'created' | 'paid' | 'failed' | 'refunded';

/**
 * Single payment transaction
 */
export interface PaymentTransaction {
    transaction_id: string;
    razorpay_payment_id: string | null;
    package_id: string;
    credits_amount: number;
    amount_paise: number;
    currency: string;
    status: PaymentStatus;
    gateway: string;
    created_at: string;
    paid_at: string | null;
    error_message: string | null;
}

/**
 * Response from GET /payments/history
 */
export interface PaymentHistoryResponse {
    transactions: PaymentTransaction[];
    total_count: number;
    page: number;
    limit: number;
}

/**
 * Error types for payment history operations
 */
export type PaymentHistoryErrorType = 'NETWORK' | 'UNAUTHORIZED' | 'SERVER_ERROR';

/**
 * Payment History API response wrapper
 */
export interface PaymentHistoryResult {
    success: boolean;
    data?: PaymentHistoryResponse;
    error?: string;
    errorType?: PaymentHistoryErrorType;
}

// ==================== API Methods ====================

/**
 * Fetch paginated payment history
 * @param page - Page number (1-indexed, default: 1)
 * @param limit - Items per page (default: 20, max: 100)
 */
export async function getPaymentHistory(
    page: number = 1,
    limit: number = 20
): Promise<PaymentHistoryResult> {
    if (!CONFIG.apiBaseUrl) {
        return {
            success: false,
            error: 'Payment History service not configured. Call configurePaymentHistoryService first.',
            errorType: 'SERVER_ERROR'
        };
    }

    // Validate and clamp parameters
    const validPage = Math.max(1, Math.floor(page));
    const validLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    try {
        const url = `${CONFIG.apiBaseUrl}/payments/history?page=${validPage}&limit=${validLimit}`;
        const response = await authenticatedFetch(url);

        if (response.status === 401) {
            return {
                success: false,
                error: 'Authentication required. Please sign in.',
                errorType: 'UNAUTHORIZED'
            };
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch payment history' }));
            return {
                success: false,
                error: errorData.detail || 'Failed to fetch payment history',
                errorType: 'SERVER_ERROR'
            };
        }

        const data: PaymentHistoryResponse = await response.json();
        return { success: true, data };
    } catch (error) {
        return {
            success: false,
            error: 'Network error. Please check your connection.',
            errorType: 'NETWORK'
        };
    }
}

// ==================== Helper Functions ====================

/**
 * Format amount from paise to rupees
 */
export function formatAmount(amountPaise: number, currency: string = 'INR'): string {
    const amount = amountPaise / 100;
    if (currency === 'INR') {
        return `₹${amount.toFixed(2)}`;
    }
    return `${currency} ${amount.toFixed(2)}`;
}

/**
 * Get display color class for payment status
 */
export function getStatusColor(status: PaymentStatus): string {
    switch (status) {
        case 'paid':
            return 'text-green-400 bg-green-950/30 border-green-500/30';
        case 'failed':
            return 'text-red-400 bg-red-950/30 border-red-500/30';
        case 'refunded':
            return 'text-amber-400 bg-amber-950/30 border-amber-500/30';
        case 'created':
        default:
            return 'text-slate-400 bg-slate-800/30 border-slate-600/30';
    }
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ==================== Convenience Exports ====================

/**
 * Payment History service object for namespaced access
 */
export const paymentHistoryService = {
    configure: configurePaymentHistoryService,
    getHistory: getPaymentHistory,
    formatAmount,
    getStatusColor,
    formatDate
};
