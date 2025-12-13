import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Toast, onToastChange, hideToast } from '../services/toastService';

// Icons for each toast type
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);

const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const WarningIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// Toast type styles
const toastStyles = {
    success: {
        bg: 'bg-green-50/95',
        border: 'border-green-200',
        icon: 'text-green-500',
        text: 'text-green-800',
        IconComponent: CheckIcon
    },
    error: {
        bg: 'bg-red-50/95',
        border: 'border-red-200',
        icon: 'text-red-500',
        text: 'text-red-800',
        IconComponent: ErrorIcon
    },
    info: {
        bg: 'bg-blue-50/95',
        border: 'border-blue-200',
        icon: 'text-blue-500',
        text: 'text-blue-800',
        IconComponent: InfoIcon
    },
    warning: {
        bg: 'bg-yellow-50/95',
        border: 'border-yellow-200',
        icon: 'text-yellow-500',
        text: 'text-yellow-800',
        IconComponent: WarningIcon
    }
};

interface ToastItemProps {
    toast: Toast;
    onClose: () => void;
    index: number;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose, index }) => {
    const [isExiting, setIsExiting] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [timeRemaining, setTimeRemaining] = useState(toast.duration);
    const style = toastStyles[toast.type];
    const IconComponent = style.IconComponent;

    const handleClose = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        setIsExiting(true);
        setTimeout(() => {
            onClose();
        }, 200);
    };

    // Auto-dismiss timer with pause on hover
    useEffect(() => {
        if (toast.duration > 0 && !isHovered && timeRemaining > 0) {
            const interval = 50; // Update every 50ms for smooth progress
            timerRef.current = setTimeout(() => {
                setTimeRemaining(prev => {
                    const newTime = prev - interval;
                    if (newTime <= 0) {
                        handleClose();
                        return 0;
                    }
                    return newTime;
                });
            }, interval);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [isHovered, timeRemaining, toast.duration]);

    // Calculate progress percentage
    const progressPercent = toast.duration > 0 ? (timeRemaining / toast.duration) * 100 : 100;

    // Progress bar color based on toast type
    const progressColors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500'
    };

    return (
        <div
            className={`
                relative flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md overflow-hidden
                ${style.bg} ${style.border}
                transform transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg
                ${isExiting ? 'animate-out fade-out slide-out-to-top-2' : 'animate-in slide-in-from-top-4 fade-in'}
            `}
            style={{
                minWidth: '280px',
                maxWidth: '400px'
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <IconComponent className={`w-5 h-5 flex-shrink-0 ${style.icon}`} />
            <p className={`flex-1 min-w-0 text-sm font-bold break-words ${style.text}`}>{toast.message}</p>
            <button
                onClick={handleClose}
                className={`p-1 flex-shrink-0 rounded-lg hover:bg-black/5 transition-all duration-300 hover:rotate-90 ${style.icon}`}
                aria-label="Dismiss"
            >
                <CloseIcon className="w-4 h-4" />
            </button>

            {/* Progress bar timer */}
            {toast.duration > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
                    <div
                        className={`h-full ${progressColors[toast.type]} transition-all duration-75 ease-linear`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            )}
        </div>
    );
};


const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const unsubscribe = onToastChange(setToasts);
        return unsubscribe;
    }, []);

    if (toasts.length === 0) return null;

    return createPortal(
        <>
            {/* Keyframes for animation */}
            {/* Keyframes for animation removed in favor of Tailwind animate-in */}
            <div
                className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-2 pointer-events-auto"
                aria-live="polite"
                aria-label="Notifications"
            >
                {toasts.map((toast, index) => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onClose={() => hideToast(toast.id)}
                        index={index}
                    />
                ))}
            </div>
        </>,
        document.body
    );
};

export default ToastContainer;
