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
        bg: 'bg-emerald-950/95',
        border: 'border-emerald-500/50',
        icon: 'text-emerald-400',
        text: 'text-emerald-100',
        IconComponent: CheckIcon
    },
    error: {
        bg: 'bg-red-950/95',
        border: 'border-red-500/50',
        icon: 'text-red-400',
        text: 'text-red-100',
        IconComponent: ErrorIcon
    },
    info: {
        bg: 'bg-blue-950/95',
        border: 'border-blue-500/50',
        icon: 'text-blue-400',
        text: 'text-blue-100',
        IconComponent: InfoIcon
    },
    warning: {
        bg: 'bg-amber-950/95',
        border: 'border-amber-500/50',
        icon: 'text-amber-400',
        text: 'text-amber-100',
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
        if (toast.duration > 0 && !isHovered) {
            timerRef.current = setTimeout(() => {
                handleClose();
            }, toast.duration);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [isHovered, toast.duration]);

    return (
        <div
            className={`
                flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md
                ${style.bg} ${style.border}
                transform transition-all duration-300 ease-out
                ${isExiting ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'}
            `}
            style={{
                animation: isExiting ? undefined : `slideDown 0.3s ease-out ${index * 0.05}s both`,
                minWidth: '280px',
                maxWidth: '400px'
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <IconComponent className={`w-5 h-5 flex-shrink-0 ${style.icon}`} />
            <p className={`flex-1 min-w-0 text-sm font-medium break-words ${style.text}`}>{toast.message}</p>
            <button
                onClick={handleClose}
                className={`p-1 flex-shrink-0 rounded-lg hover:bg-white/10 transition-colors ${style.icon}`}
                aria-label="Dismiss"
            >
                <CloseIcon className="w-4 h-4" />
            </button>
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
            <style>{`
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
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
