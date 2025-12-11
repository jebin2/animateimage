import { getUserId } from './userIdService';

const API_BASE_URL = 'https://jebin2-apigateway.hf.space';

export interface AuthResponse {
    success: boolean;
    message?: string;
    is_registered?: boolean;
    user_id?: string;
    credits?: number;
    errorType?: 'NETWORK' | 'RATE_LIMIT' | 'NOT_FOUND' | 'INVALID_EMAIL' | 'SERVER_ERROR' | 'UNKNOWN';
}

export const authService = {
    async checkRegistration(): Promise<boolean> {
        const userId = getUserId();
        if (!userId) return false;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/check-registration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
            });

            if (!response.ok) return false;
            const data = await response.json();
            return data.is_registered === true;
        } catch (error) {
            console.error('Error checking registration:', error);
            return false;
        }
    },

    async register(email: string): Promise<AuthResponse> {
        const userId = getUserId();
        if (!userId) return { success: false, message: 'User ID not found', errorType: 'UNKNOWN' };

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, email }),
            });

            const data = await response.json();

            if (response.status === 429) {
                return { success: false, message: 'Too many attempts. Try again later.', errorType: 'RATE_LIMIT' };
            }

            return {
                success: response.ok,
                message: data.message || data.detail || (response.ok ? 'Registration successful' : 'Registration failed'),
                errorType: response.ok ? undefined : 'SERVER_ERROR'
            };
        } catch (error) {
            return { success: false, message: 'Network error. Please check your connection.', errorType: 'NETWORK' };
        }
    },

    async validateSecretKey(secretKey: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret_key: secretKey }),
            });

            const data = await response.json();

            if (response.status === 401) {
                return { success: false, message: 'Invalid secret key.', errorType: 'NOT_FOUND' };
            }

            return {
                success: response.ok && data.valid === true,
                user_id: data.user_id,
                credits: data.credits,
                message: data.message,
                errorType: response.ok ? undefined : 'SERVER_ERROR'
            };
        } catch (error) {
            return { success: false, message: 'Validation failed. Check connection.', errorType: 'NETWORK' };
        }
    },

    async resetSecretKey(email: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.status === 404) {
                return { success: false, message: 'Email not found.', errorType: 'NOT_FOUND' };
            }
            if (response.status === 429) {
                return { success: false, message: 'Too many attempts. Try again in 1 hour.', errorType: 'RATE_LIMIT' };
            }

            return {
                success: response.ok,
                message: data.message || 'Reset instructions sent',
                errorType: response.ok ? undefined : 'SERVER_ERROR'
            };
        } catch (error) {
            return { success: false, message: 'Failed to request reset. Check connection.', errorType: 'NETWORK' };
        }
    }
};
