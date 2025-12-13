// Contact Service
// A modular, standalone service for submitting contact messages
// Plug-and-play: configure once, use anywhere

import { authenticatedFetch } from './googleAuthService';

// ==================== Configuration ====================

let CONFIG = {
    apiBaseUrl: ''
};

/**
 * Configure the Contact service
 * @param config.apiBaseUrl - Backend API base URL
 */
export function configureContactService(config: { apiBaseUrl: string }) {
    CONFIG.apiBaseUrl = config.apiBaseUrl;
}

// ==================== Types ====================

/**
 * Request payload for POST /contact
 */
export interface ContactRequest {
    subject?: string;
    message: string;
}

/**
 * Response from POST /contact
 */
export interface ContactResponse {
    success: boolean;
    message: string;
    email: string;
}

/**
 * Error types for contact operations
 */
export type ContactErrorType = 'NETWORK' | 'UNAUTHORIZED' | 'VALIDATION' | 'SERVER_ERROR';

/**
 * Contact API response wrapper
 */
export interface ContactResult {
    success: boolean;
    data?: ContactResponse;
    error?: string;
    errorType?: ContactErrorType;
}

// ==================== API Methods ====================

/**
 * Submit a contact form message
 * @param request - Contact form data with optional subject and required message
 */
export async function submitContactForm(request: ContactRequest): Promise<ContactResult> {
    if (!CONFIG.apiBaseUrl) {
        return {
            success: false,
            error: 'Contact service not configured. Call configureContactService first.',
            errorType: 'SERVER_ERROR'
        };
    }

    // Validate required fields
    if (!request.message || request.message.trim().length === 0) {
        return {
            success: false,
            error: 'Message is required.',
            errorType: 'VALIDATION'
        };
    }

    try {
        const response = await authenticatedFetch(`${CONFIG.apiBaseUrl}/contact`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subject: request.subject?.trim() || undefined,
                message: request.message.trim()
            })
        });

        if (response.status === 401) {
            return {
                success: false,
                error: 'Authentication required. Please sign in.',
                errorType: 'UNAUTHORIZED'
            };
        }

        if (response.status === 422) {
            const errorData = await response.json().catch(() => ({ detail: 'Validation error' }));
            return {
                success: false,
                error: errorData.detail || 'Please check your input.',
                errorType: 'VALIDATION'
            };
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to submit message' }));
            return {
                success: false,
                error: errorData.detail || 'Failed to submit message',
                errorType: 'SERVER_ERROR'
            };
        }

        const data: ContactResponse = await response.json();
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
 * Contact service object for namespaced access
 */
export const contactService = {
    configure: configureContactService,
    submit: submitContactForm
};
