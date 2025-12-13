// Toast notification service
// Generic, plug-and-play toast system for any application

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration: number;
}

export interface ToastConfig {
    id?: string;
    type: ToastType;
    message: string;
    duration?: number; // ms, default 4000, 0 = no auto-dismiss
}

// Internal state
let toasts: Toast[] = [];
let listeners: ((toasts: Toast[]) => void)[] = [];
let idCounter = 0;

// Notify all listeners of state change
function notifyListeners(): void {
    listeners.forEach(callback => callback([...toasts]));
}

// Generate unique ID
function generateId(): string {
    return `toast-${++idCounter}-${Date.now()}`;
}

/**
 * Show a toast notification
 * @returns The toast ID (can be used to dismiss it)
 */
export function showToast(config: ToastConfig): string {
    const id = config.id || generateId();
    const duration = config.duration ?? 4000;

    const toast: Toast = {
        id,
        type: config.type,
        message: config.message,
        duration
    };

    toasts = [...toasts, toast];
    notifyListeners();

    // Auto-dismiss if duration > 0
    if (duration > 0) {
        setTimeout(() => {
            hideToast(id);
        }, duration);
    }

    return id;
}

/**
 * Hide a specific toast by ID
 */
export function hideToast(id: string): void {
    const index = toasts.findIndex(t => t.id === id);
    if (index !== -1) {
        toasts = toasts.filter(t => t.id !== id);
        notifyListeners();
    }
}

/**
 * Hide all toasts
 */
export function hideAllToasts(): void {
    toasts = [];
    notifyListeners();
}

/**
 * Subscribe to toast state changes
 * @returns Unsubscribe function
 */
export function onToastChange(callback: (toasts: Toast[]) => void): () => void {
    listeners.push(callback);
    // Immediately call with current state
    callback([...toasts]);

    return () => {
        listeners = listeners.filter(l => l !== callback);
    };
}

/**
 * Get current toasts (snapshot)
 */
export function getToasts(): Toast[] {
    return [...toasts];
}

// Convenience methods
export function showSuccess(message: string, duration?: number): string {
    return showToast({ type: 'success', message, duration });
}

export function showError(message: string, duration?: number): string {
    return showToast({ type: 'error', message, duration: duration ?? 6000 }); // Errors show longer
}

export function showInfo(message: string, duration?: number): string {
    return showToast({ type: 'info', message, duration });
}

export function showWarning(message: string, duration?: number): string {
    return showToast({ type: 'warning', message, duration: duration ?? 5000 });
}
