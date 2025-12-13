import React, { useEffect, useRef, useState } from 'react';
import { renderGoogleButton } from '../services/googleAuthService';
import { GoogleIcon } from './Icons';

interface CustomGoogleSignInButtonProps {
    width?: string;
}

const CustomGoogleSignInButton: React.FC<CustomGoogleSignInButtonProps> = ({ width = '100%' }) => {
    const googleButtonRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let attempts = 0;
        const maxAttempts = 20; // 20 attempts * 500ms = 10 seconds max
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const tryRenderButton = () => {
            if (!googleButtonRef.current || !containerRef.current) {
                return;
            }

            // Check if Google library is loaded
            if (!window.google?.accounts?.id) {
                attempts++;
                if (attempts < maxAttempts) {
                    // Retry after 500ms
                    timeoutId = setTimeout(tryRenderButton, 500);
                } else {
                    console.error('Google Identity Services failed to load after maximum attempts');
                }
                return;
            }

            // Calculate width to match container
            const containerWidth = containerRef.current.offsetWidth;

            try {
                renderGoogleButton(googleButtonRef.current, {
                    theme: 'outline',
                    size: 'large',
                    width: containerWidth,
                    shape: 'pill'
                });
                // Mark as ready only after successful render
                setIsReady(true);
            } catch (e) {
                console.error('Failed to render Google button:', e);
            }
        };

        tryRenderButton();

        // Cleanup on unmount
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, []);

    return (
        <div ref={containerRef} className="relative group cursor-pointer" style={{ width }}>
            {/* Custom Styled Button (Visible) */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 bg-white border border-slate-200 rounded-full shadow-sm group-hover:shadow-md group-hover:border-purple-200 transition-all duration-300 group-hover:scale-[1.02]">
                <GoogleIcon className="w-5 h-5" />
                <span className="font-bold text-slate-600 group-hover:text-purple-600 transition-colors text-sm sm:text-base hidden sm:inline">
                    Sign in
                </span>
            </div>

            {/* Actual Google Button (Invisible Overlay) - only clickable when ready */}
            <div
                ref={googleButtonRef}
                className={`absolute inset-0 opacity-0 z-10 overflow-hidden ${isReady ? '' : 'pointer-events-none'}`}
                style={{ transform: 'scale(1.05)' }} // Slight scale to ensure coverage
            />
        </div>
    );
};

export default CustomGoogleSignInButton;
