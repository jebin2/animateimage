import React, { useState, useEffect } from 'react';
import { getAvatarCacheKey } from '../services/googleAuthService';

interface UserAvatarProps {
    src?: string | null;
    name?: string | null;
    email: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

// Cache avatar as data URL in localStorage
async function cacheAvatar(url: string, cacheKey: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                try {
                    localStorage.setItem(cacheKey, dataUrl);
                } catch {
                    // localStorage full, ignore
                }
                resolve(dataUrl);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

// Get cached avatar from localStorage
function getCachedAvatar(cacheKey: string): string | null {
    try {
        return localStorage.getItem(cacheKey);
    } catch {
        return null;
    }
}

// Clear cached avatar (uses dynamic key from service)
export function clearCachedAvatar(): void {
    try {
        localStorage.removeItem(getAvatarCacheKey());
    } catch {
        // ignore
    }
}

const UserAvatar: React.FC<UserAvatarProps> = ({
    src,
    name,
    email,
    size = 'md',
    className = ''
}) => {
    const [imageSrc, setImageSrc] = useState<string | null>(src || null);
    const [imageError, setImageError] = useState(false);

    const sizeClasses = {
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-base',
        lg: 'w-12 h-12 text-lg'
    };

    // Get initials from name or email
    const getInitials = () => {
        if (name) {
            return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }
        return email[0].toUpperCase();
    };

    // Generate a consistent color based on email
    const getAvatarColor = () => {
        const colors = [
            'bg-indigo-600',
            'bg-purple-600',
            'bg-pink-600',
            'bg-blue-600',
            'bg-teal-600',
            'bg-emerald-600',
            'bg-orange-600'
        ];
        const index = email.charCodeAt(0) % colors.length;
        return colors[index];
    };

    // Try to cache avatar on first load or use cached version on error
    useEffect(() => {
        if (src && !imageError) {
            const cacheKey = getAvatarCacheKey();
            cacheAvatar(src, cacheKey).catch(() => { });
        }
    }, [src, imageError]);

    // Handle image load error
    const handleError = () => {
        const cacheKey = getAvatarCacheKey();
        const cached = getCachedAvatar(cacheKey);
        if (cached && cached !== imageSrc) {
            setImageSrc(cached);
        } else {
            setImageError(true);
        }
    };

    // Show image if available and no error
    if (imageSrc && !imageError) {
        return (
            <img
                src={imageSrc}
                alt={name || email}
                className={`${sizeClasses[size]} rounded-full border-2 border-slate-700 ${className}`}
                onError={handleError}
            />
        );
    }

    // Fallback to initials
    return (
        <div className={`${sizeClasses[size]} rounded-full ${getAvatarColor()} flex items-center justify-center text-white font-medium border-2 border-slate-700 ${className}`}>
            {getInitials()}
        </div>
    );
};

export default UserAvatar;
