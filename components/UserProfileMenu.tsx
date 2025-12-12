import React, { useState, useRef, useEffect } from 'react';
import { GoogleUser, signOut } from '../services/googleAuthService';
import { LogOutIcon, UserIcon, CreditCardIcon, ChevronDownIcon } from './Icons';

interface UserProfileMenuProps {
    user: GoogleUser;
    onSignOut: () => void;
}

const UserProfileMenu: React.FC<UserProfileMenuProps> = ({ user, onSignOut }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSignOut = async () => {
        setIsOpen(false);
        await signOut();
        onSignOut();
    };

    // Get initials from name or email
    const getInitials = () => {
        if (user.name) {
            return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }
        return user.email[0].toUpperCase();
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
        const index = user.email.charCodeAt(0) % colors.length;
        return colors[index];
    };

    return (
        <div className="relative" ref={menuRef}>
            {/* Profile Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-slate-800 transition-colors"
            >
                {user.profilePicture ? (
                    <img
                        src={user.profilePicture}
                        alt={user.name || user.email}
                        className="w-8 h-8 rounded-full border-2 border-slate-700"
                    />
                ) : (
                    <div className={`w-8 h-8 rounded-full ${getAvatarColor()} flex items-center justify-center text-white text-sm font-medium border-2 border-slate-700`}>
                        {getInitials()}
                    </div>
                )}
                <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* User Info Header */}
                    <div className="p-4 bg-slate-800/50 border-b border-slate-700">
                        <div className="flex items-center gap-3">
                            {user.profilePicture ? (
                                <img
                                    src={user.profilePicture}
                                    alt={user.name || user.email}
                                    className="w-12 h-12 rounded-full border-2 border-slate-600"
                                />
                            ) : (
                                <div className={`w-12 h-12 rounded-full ${getAvatarColor()} flex items-center justify-center text-white text-lg font-medium border-2 border-slate-600`}>
                                    {getInitials()}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">
                                    {user.name || 'User'}
                                </p>
                                <p className="text-sm text-slate-400 truncate">
                                    {user.email}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Credits */}
                    <div className="p-3 border-b border-slate-700/50">
                        <div className="flex items-center gap-3 p-2 bg-indigo-950/30 rounded-lg border border-indigo-500/20">
                            <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                                <CreditCardIcon className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-400">Credits Available</p>
                                <p className="text-lg font-bold text-indigo-300">{user.credits}</p>
                            </div>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="p-2">
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
                        >
                            <LogOutIcon className="w-4 h-4" />
                            <span className="text-sm font-medium">Sign out</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfileMenu;
