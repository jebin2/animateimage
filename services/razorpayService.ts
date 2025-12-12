// Razorpay Service
// A modular, standalone service for Razorpay payment integration
// Plug-and-play: configure once, use anywhere

import { authenticatedFetch } from './googleAuthService';

// ==================== TypeScript Declarations ====================

declare global {
    interface Window {
        Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
    }
}

interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    order_id: string;
    name: string;
    description: string;
    handler: (response: RazorpayPaymentResponse) => void;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    theme?: {
        color?: string;
    };
    modal?: {
        ondismiss?: () => void;
    };
}

interface RazorpayInstance {
    open: () => void;
    close: () => void;
}

interface RazorpayPaymentResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

// ==================== Configuration ====================

let CONFIG = {
    apiBaseUrl: ''
};

/**
 * Configure the Razorpay service
 * @param config.apiBaseUrl - Backend API base URL
 */
export function configureRazorpayService(config: { apiBaseUrl: string }) {
    CONFIG.apiBaseUrl = config.apiBaseUrl;
}

// ==================== Types ====================

/**
 * Credit package available for purchase
 */
export interface CreditPackage {
    id: string;
    name: string;
    credits: number;
    amount_paise: number;
    amount_rupees: number;
    currency: string;
}

/**
 * Response from GET /payments/packages
 */
export interface PackagesResponse {
    packages: CreditPackage[];
}

/**
 * Response from POST /payments/create-order
 */
export interface RazorpayOrder {
    transaction_id: string;
    razorpay_order_id: string;
    amount_paise: number;
    currency: string;
    key_id: string;
    package_id: string;
    credits: number;
}

/**
 * Response from POST /payments/verify
 */
export interface PaymentVerificationResult {
    success: boolean;
    message: string;
    transaction_id: string;
    credits_added: number;
    new_balance: number;
}

/**
 * Error types for Razorpay operations
 */
export type RazorpayErrorType = 'NETWORK' | 'UNAUTHORIZED' | 'SERVER_ERROR' | 'CHECKOUT_CLOSED' | 'RAZORPAY_NOT_LOADED';

/**
 * Razorpay API response wrapper
 */
export interface RazorpayResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    errorType?: RazorpayErrorType;
}

// ==================== API Methods ====================

/**
 * Get available credit packages (no auth required)
 */
export async function getPackages(): Promise<RazorpayResponse<CreditPackage[]>> {
    if (!CONFIG.apiBaseUrl) {
        return {
            success: false,
            error: 'Razorpay service not configured. Call configureRazorpayService first.',
            errorType: 'SERVER_ERROR'
        };
    }

    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/payments/packages`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch packages' }));
            return {
                success: false,
                error: errorData.detail || 'Failed to fetch packages',
                errorType: 'SERVER_ERROR'
            };
        }

        const data: PackagesResponse = await response.json();
        return { success: true, data: data.packages };
    } catch (error) {
        return {
            success: false,
            error: 'Network error. Please check your connection.',
            errorType: 'NETWORK'
        };
    }
}

/**
 * Create a Razorpay order for a package (requires JWT)
 * @param packageId - ID of the package to purchase
 */
export async function createOrder(packageId: string): Promise<RazorpayResponse<RazorpayOrder>> {
    if (!CONFIG.apiBaseUrl) {
        return {
            success: false,
            error: 'Razorpay service not configured. Call configureRazorpayService first.',
            errorType: 'SERVER_ERROR'
        };
    }

    try {
        const response = await authenticatedFetch(`${CONFIG.apiBaseUrl}/payments/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ package_id: packageId })
        });

        if (response.status === 401) {
            return {
                success: false,
                error: 'Authentication required. Please sign in.',
                errorType: 'UNAUTHORIZED'
            };
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to create order' }));
            return {
                success: false,
                error: errorData.detail || 'Failed to create order',
                errorType: 'SERVER_ERROR'
            };
        }

        const data: RazorpayOrder = await response.json();
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
 * Verify payment after Razorpay checkout (requires JWT)
 * @param paymentData - Payment response from Razorpay
 */
export async function verifyPayment(paymentData: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}): Promise<RazorpayResponse<PaymentVerificationResult>> {
    if (!CONFIG.apiBaseUrl) {
        return {
            success: false,
            error: 'Razorpay service not configured. Call configureRazorpayService first.',
            errorType: 'SERVER_ERROR'
        };
    }

    try {
        const response = await authenticatedFetch(`${CONFIG.apiBaseUrl}/payments/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });

        if (response.status === 401) {
            return {
                success: false,
                error: 'Authentication required. Please sign in.',
                errorType: 'UNAUTHORIZED'
            };
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Payment verification failed' }));
            return {
                success: false,
                error: errorData.detail || 'Payment verification failed',
                errorType: 'SERVER_ERROR'
            };
        }

        const data: PaymentVerificationResult = await response.json();
        return { success: true, data };
    } catch (error) {
        return {
            success: false,
            error: 'Network error. Please check your connection.',
            errorType: 'NETWORK'
        };
    }
}

// ==================== Checkout Helper ====================

export interface CheckoutOptions {
    order: RazorpayOrder;
    appName?: string;
    userEmail?: string;
    userName?: string;
    themeColor?: string;
    onSuccess: (result: PaymentVerificationResult) => void;
    onError: (error: string) => void;
    onDismiss?: () => void;
}

/**
 * Open Razorpay checkout modal and handle the complete payment flow
 */
export async function openCheckout(options: CheckoutOptions): Promise<void> {
    const {
        order,
        appName = 'AnimateImage',
        userEmail,
        userName,
        themeColor = '#6366f1', // Indigo-500
        onSuccess,
        onError,
        onDismiss
    } = options;

    // Check if Razorpay is loaded
    if (!window.Razorpay) {
        onError('Razorpay checkout is not loaded. Please refresh the page.');
        return;
    }

    const razorpayOptions: RazorpayOptions = {
        key: order.key_id,
        amount: order.amount_paise,
        currency: order.currency,
        order_id: order.razorpay_order_id,
        name: appName,
        description: `${order.credits} Credits`,
        handler: async (response: RazorpayPaymentResponse) => {
            // Verify payment with server
            const verifyResult = await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
            });

            if (verifyResult.success && verifyResult.data) {
                onSuccess(verifyResult.data);
            } else {
                onError(verifyResult.error || 'Payment verification failed');
            }
        },
        prefill: {
            email: userEmail,
            name: userName
        },
        theme: {
            color: themeColor
        },
        modal: {
            ondismiss: onDismiss
        }
    };

    const razorpay = new window.Razorpay(razorpayOptions);
    razorpay.open();
}

// ==================== Complete Purchase Flow ====================

export interface PurchaseOptions {
    packageId: string;
    appName?: string;
    userEmail?: string;
    userName?: string;
    onSuccess: (result: PaymentVerificationResult) => void;
    onError: (error: string) => void;
    onDismiss?: () => void;
}

/**
 * Complete purchase flow: create order and open checkout
 * This is a convenience function that combines createOrder and openCheckout
 */
export async function purchaseCredits(options: PurchaseOptions): Promise<void> {
    const { packageId, onError, ...checkoutOptions } = options;

    // Step 1: Create order
    const orderResult = await createOrder(packageId);

    if (!orderResult.success || !orderResult.data) {
        onError(orderResult.error || 'Failed to create order');
        return;
    }

    // Step 2: Open checkout
    await openCheckout({
        order: orderResult.data,
        onError,
        ...checkoutOptions
    });
}

// ==================== Convenience Exports ====================

/**
 * Razorpay service object for namespaced access
 */
export const razorpayService = {
    configure: configureRazorpayService,
    getPackages,
    createOrder,
    verifyPayment,
    openCheckout,
    purchaseCredits
};
