import React, { useState, useRef, useEffect } from 'react';
import { GoogleUser, signOut } from '../services/googleAuthService';
import { LogOutIcon, CreditCardIcon, ChevronDownIcon, ShoppingCartIcon, MessageIcon, HistoryIcon } from './Icons';
import UserAvatar, { clearCachedAvatar } from './UserAvatar';
import BuyCreditsModal from './BuyCreditsModal';
import ContactModal from './ContactModal';
import PaymentHistoryModal from './PaymentHistoryModal';

interface UserProfileMenuProps {
    user: GoogleUser;
    onSignOut: () => void;
    onCreditsUpdated?: (newBalance: number) => void;
}

const UserProfileMenu: React.FC<UserProfileMenuProps> = ({ user, onSignOut, onCreditsUpdated }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showBuyCredits, setShowBuyCredits] = useState(false);
    const [showContact, setShowContact] = useState(false);
    const [showPaymentHistory, setShowPaymentHistory] = useState(false);
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

    const handleBuyCreditsClick = () => {
        setShowBuyCredits(true);
        setIsOpen(false); // Close the dropdown when opening modal
    };

    const handleContactClick = () => {
        setShowContact(true);
        setIsOpen(false);
    };

    const handlePaymentHistoryClick = () => {
        setShowPaymentHistory(true);
        setIsOpen(false);
    };

    return (
        <>
            <div className="relative" ref={menuRef}>
                {/* Profile Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-full hover:bg-white/50 transition-all duration-300 hover:scale-105 active:scale-95 border border-transparent hover:border-white/50"
                >
                    <UserAvatar
                        src={user.profilePicture}
                        name={user.name}
                        email={user.email}
                        size="sm"
                    />
                    <ChevronDownIcon className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-full sm:mt-2 w-[calc(100vw-16px)] sm:w-72 max-w-80 bg-white border border-white/60 rounded-2xl shadow-xl shadow-purple-100/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* User Info Header */}
                        <div className="p-3 sm:p-4 bg-purple-50/50 border-b border-purple-100">
                            <div className="flex items-center gap-3">
                                <UserAvatar
                                    src={user.profilePicture}
                                    name={user.name}
                                    email={user.email}
                                    size="lg"
                                    className="border-white shadow-sm"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 truncate text-sm sm:text-base">
                                        {user.name || 'User'}
                                    </p>
                                    <p className="text-xs sm:text-sm text-slate-500 truncate">
                                        {user.email}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Credits */}
                        <div className="p-2 sm:p-3 border-b border-slate-50">
                            <div className="flex items-center justify-between gap-2 p-2 bg-pink-50/50 rounded-xl border border-pink-100">
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                        <CreditCardIcon className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-pink-400 uppercase tracking-wider">Credits</p>
                                        <p className="text-base sm:text-lg font-bold text-slate-700">{user.credits}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleBuyCreditsClick}
                                    className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-white hover:bg-pink-50 text-pink-500 hover:text-pink-600 text-xs sm:text-sm font-bold rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 border border-pink-100 shadow-sm"
                                >
                                    <ShoppingCartIcon className="w-4 h-4" />
                                    Buy
                                </button>
                            </div>
                        </div>

                        {/* Menu Items */}
                        <div className="p-2">
                            <button
                                onClick={handleContactClick}
                                className="w-full flex items-center gap-3 px-3 py-2 sm:py-2.5 text-left text-slate-600 hover:bg-purple-50 hover:text-purple-600 rounded-xl transition-all duration-300 hover:translate-x-1 font-medium"
                            >
                                <MessageIcon className="w-4 h-4" />
                                <span className="text-xs sm:text-sm">Contact Us</span>
                            </button>
                            <button
                                onClick={handlePaymentHistoryClick}
                                className="w-full flex items-center gap-3 px-3 py-2 sm:py-2.5 text-left text-slate-600 hover:bg-purple-50 hover:text-purple-600 rounded-xl transition-all duration-300 hover:translate-x-1 font-medium"
                            >
                                <HistoryIcon className="w-4 h-4" />
                                <span className="text-xs sm:text-sm">Payment History</span>
                            </button>
                            <div className="my-1 border-t border-slate-100" />
                            <button
                                onClick={handleSignOut}
                                className="w-full flex items-center gap-3 px-3 py-2 sm:py-2.5 text-left text-slate-600 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all duration-300 hover:translate-x-1 font-medium"
                            >
                                <LogOutIcon className="w-4 h-4" />
                                <span className="text-xs sm:text-sm">Sign out</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Buy Credits Modal */}
            <BuyCreditsModal
                isOpen={showBuyCredits}
                onClose={() => setShowBuyCredits(false)}
                user={user}
                onCreditsUpdated={onCreditsUpdated}
            />

            {/* Contact Modal */}
            <ContactModal
                isOpen={showContact}
                onClose={() => setShowContact(false)}
            />

            {/* Payment History Modal */}
            <PaymentHistoryModal
                isOpen={showPaymentHistory}
                onClose={() => setShowPaymentHistory(false)}
            />
        </>
    );
};

export default UserProfileMenu;

