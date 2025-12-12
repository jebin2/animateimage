import React, { useState, useRef, useEffect } from 'react';
import { GoogleUser, signOut } from '../services/googleAuthService';
import { LogOutIcon, CreditCardIcon, ChevronDownIcon } from './Icons';
import UserAvatar, { clearCachedAvatar } from './UserAvatar';

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
        clearCachedAvatar(); // Clear cached avatar on sign out
        await signOut();
        onSignOut();
    };

    return (
        <div className="relative" ref={menuRef}>
            {/* Profile Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-slate-800 transition-colors"
            >
                <UserAvatar
                    src={user.profilePicture}
                    name={user.name}
                    email={user.email}
                    size="sm"
                />
                <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* User Info Header */}
                    <div className="p-4 bg-slate-800/50 border-b border-slate-700">
                        <div className="flex items-center gap-3">
                            <UserAvatar
                                src={user.profilePicture}
                                name={user.name}
                                email={user.email}
                                size="lg"
                                className="border-slate-600"
                            />
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
