import React, { useEffect, useRef } from 'react';
import { renderGoogleButton } from '../services/googleAuthService';
import { GoogleIcon } from './Icons';

interface CustomGoogleSignInButtonProps {
    width?: string;
}

const CustomGoogleSignInButton: React.FC<CustomGoogleSignInButtonProps> = ({ width = '100%' }) => {
    const googleButtonRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (googleButtonRef.current && containerRef.current) {
            // Calculate width to match container
            const containerWidth = containerRef.current.offsetWidth;

            try {
                renderGoogleButton(googleButtonRef.current, {
                    theme: 'outline',
                    size: 'large',
                    width: containerWidth,
                    shape: 'pill'
                });
            } catch (e) {
                console.error('Failed to render Google button:', e);
            }
        }
    }, []);

    return (
        <div ref={containerRef} className="relative group cursor-pointer" style={{ width }}>
            {/* Custom Styled Button (Visible) */}
            <div className="flex items-center justify-center gap-3 px-6 py-3 bg-white border border-slate-200 rounded-full shadow-sm group-hover:shadow-md group-hover:border-purple-200 transition-all duration-300 group-hover:scale-[1.02]">
                <GoogleIcon className="w-5 h-5" />
                <span className="font-bold text-slate-600 group-hover:text-purple-600 transition-colors">
                    Sign in with Google
                </span>
            </div>

            {/* Actual Google Button (Invisible Overlay) */}
            <div
                ref={googleButtonRef}
                className="absolute inset-0 opacity-0 z-10 overflow-hidden"
                style={{ transform: 'scale(1.05)' }} // Slight scale to ensure coverage
            />
        </div>
    );
};

export default CustomGoogleSignInButton;
