// Process History Service
// Service for fetching job history (video/image generations)

import { authenticatedFetch } from './googleAuthService';

// ==================== Configuration ====================

let CONFIG = {
    apiBaseUrl: ''
};

/**
 * Configure the Process History service
 * @param config.apiBaseUrl - Backend API base URL
 */
export function configureProcessHistoryService(config: { apiBaseUrl: string }) {
    CONFIG.apiBaseUrl = config.apiBaseUrl;
}

// ==================== Types ====================

export type JobType = 'video' | 'image';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface Job {
    job_id: string;
    job_type: JobType;
    status: JobStatus;
    created_at: string;
    completed_at: string | null;
    prompt?: string;
    download_url?: string;
    error_message?: string;
}

export interface ProcessHistoryResponse {
    jobs: Job[];
    total_count: number;
    page: number;
    limit: number;
}

export type ProcessHistoryErrorType = 'NETWORK' | 'UNAUTHORIZED' | 'SERVER_ERROR';

export interface ProcessHistoryResult {
    success: boolean;
    data?: ProcessHistoryResponse;
    error?: string;
    errorType?: ProcessHistoryErrorType;
}

// ==================== API Methods ====================

/**
 * Fetch paginated process history
 * @param page - Page number (1-indexed, default: 1)
 * @param limit - Items per page (default: 20)
 */
export async function getProcessHistory(
    page: number = 1,
    limit: number = 20
): Promise<ProcessHistoryResult> {
    if (!CONFIG.apiBaseUrl) {
        return {
            success: false,
            error: 'Process History service not configured. Call configureProcessHistoryService first.',
            errorType: 'SERVER_ERROR'
        };
    }

    // Validate parameters
    const validPage = Math.max(1, Math.floor(page));
    const validLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    try {
        const url = `${CONFIG.apiBaseUrl}/gemini/jobs?page=${validPage}&limit=${validLimit}`;
        const response = await authenticatedFetch(url);

        if (response.status === 401) {
            return {
                success: false,
                error: 'Authentication required. Please sign in.',
                errorType: 'UNAUTHORIZED'
            };
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch process history' }));
            return {
                success: false,
                error: errorData.detail || 'Failed to fetch process history',
                errorType: 'SERVER_ERROR'
            };
        }

        const data: ProcessHistoryResponse = await response.json();
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
 * Get display color class for job status
 */
export function getJobStatusColor(status: JobStatus): string {
    switch (status) {
        case 'completed':
            return 'text-green-700 bg-green-50 border-green-200 border';
        case 'failed':
            return 'text-red-700 bg-red-50 border-red-200 border';
        case 'processing':
            return 'text-blue-700 bg-blue-50 border-blue-200 border';
        case 'queued':
            return 'text-amber-700 bg-amber-50 border-amber-200 border';
        default:
            return 'text-slate-700 bg-slate-50 border-slate-200 border';
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

export const processHistoryService = {
    configure: configureProcessHistoryService,
    getHistory: getProcessHistory,
    getStatusColor: getJobStatusColor,
    formatDate
};
