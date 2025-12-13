import React, { useEffect, useRef, useState } from 'react';
import { renderGoogleButton, signInWithGoogle } from '../services/googleAuthService';
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

    // Fallback click handler for when overlay doesn't work
    const handleClick = () => {
        if (!isReady) {
            // If Google button not ready, try to trigger sign-in directly
            signInWithGoogle();
        }
        // If ready, the Google button overlay should handle the click
    };

    return (
        <div ref={containerRef} className="relative group" style={{ width }}>
            {/* Custom Styled Button (Visible) - now also handles clicks as fallback */}
            <button
                type="button"
                onClick={handleClick}
                className="w-full flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow-md hover:border-purple-200 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
            >
                <GoogleIcon className="w-5 h-5" />
                <span className="font-bold text-slate-600 group-hover:text-purple-600 transition-colors text-sm sm:text-base hidden sm:inline">
                    Sign in
                </span>
            </button>

            {/* Actual Google Button (Invisible Overlay) - positioned on top when ready */}
            <div
                ref={googleButtonRef}
                className={`absolute inset-0 z-10 overflow-hidden rounded-full ${isReady ? 'opacity-[0.01]' : 'opacity-0 pointer-events-none'}`}
            />
        </div>
    );
};

export default CustomGoogleSignInButton;
