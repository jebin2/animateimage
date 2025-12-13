import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CreditPackage, getPackages, purchaseCredits, PaymentVerificationResult } from '../services/razorpayService';
import { fetchUserInfo, GoogleUser } from '../services/googleAuthService';
import { showSuccess, showError } from '../services/toastService';
import { CreditCardIcon, AlertCircleIcon, SparklesIcon } from './Icons';

interface BuyCreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: GoogleUser;
    onCreditsUpdated?: (newBalance: number) => void;
}

const BuyCreditsModal: React.FC<BuyCreditsModalProps> = ({ isOpen, onClose, user, onCreditsUpdated }) => {
    const [packages, setPackages] = useState<CreditPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null); // Only for package loading errors
    const [purchasing, setPurchasing] = useState<string | null>(null);

    // Fetch packages on mount
    useEffect(() => {
        if (isOpen) {
            // Reset state when modal opens
            setError(null);
            loadPackages();
        }
    }, [isOpen]);

    const loadPackages = async () => {
        setLoading(true);
        setError(null);
        const result = await getPackages();
        if (result.success && result.data) {
            setPackages(result.data);
        } else {
            setError(result.error || 'Failed to load packages');
        }
        setLoading(false);
    };

    const handlePurchase = async (pkg: CreditPackage) => {
        setPurchasing(pkg.id);
        setError(null);

        await purchaseCredits({
            packageId: pkg.id,
            appName: 'AnimateImage',
            userEmail: user.email,
            userName: user.name || undefined,
            onSuccess: async (result: PaymentVerificationResult) => {
                setPurchasing(null);
                // Show success toast
                showSuccess(`Success! New balance: ${result.new_balance} credits`);

                // Refresh user info to update credits display
                await fetchUserInfo();
                onCreditsUpdated?.(result.new_balance);

                // Close the modal after successful purchase
                onClose();
            },
            onError: (errorMsg: string) => {
                setPurchasing(null);
                // Show error toast
                showError(errorMsg);
            },
            onDismiss: () => {
                setPurchasing(null);
            }
        });
    };

    if (!isOpen) return null;

    // Use portal to render modal outside of parent stacking context
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white border border-white/60 rounded-3xl shadow-2xl shadow-purple-100/50 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* Header - Fixed */}
                <div className="flex-shrink-0 p-6 border-b border-purple-100 bg-gradient-to-r from-purple-50/50 to-pink-50/50 rounded-t-3xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                <SparklesIcon className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold font-display text-slate-800">Buy Credits</h2>
                                <p className="text-sm text-slate-500 font-medium">Choose a credit package</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/50 transition-all duration-300 hover:rotate-90 text-slate-400 hover:text-slate-600"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {/* Current Balance */}
                    <div className="flex items-center gap-3 p-4 mb-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <CreditCardIcon className="w-5 h-5 text-purple-400" />
                        <span className="text-slate-500 font-medium">Current Balance:</span>
                        <span className="font-bold text-purple-600">{user.credits} credits</span>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-slate-400">Loading packages...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="flex items-center gap-3 p-4 mb-4 bg-red-950/30 border border-red-500/30 rounded-xl">
                            <AlertCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
                            <p className="text-red-300 text-sm">{error}</p>
                            <button
                                onClick={loadPackages}
                                className="ml-auto text-sm text-red-400 hover:text-red-300 underline"
                            >
                                Retry
                            </button>
                        </div>
                    )}



                    {/* Package Cards */}
                    {!loading && packages.length > 0 && (
                        <div className="space-y-3">
                            {packages.map((pkg) => (
                                <button
                                    key={pkg.id}
                                    onClick={() => handlePurchase(pkg)}
                                    disabled={purchasing !== null}
                                    className={`
                                        w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300
                                        ${purchasing === pkg.id
                                            ? 'bg-purple-50 border-purple-200 cursor-wait'
                                            : 'bg-white border-slate-100 hover:border-purple-200 hover:shadow-md hover:shadow-purple-100 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                                        }
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    `}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`
                                            w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm
                                            ${pkg.id === 'pro'
                                                ? 'bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600'
                                                : pkg.id === 'standard'
                                                    ? 'bg-gradient-to-br from-purple-100 to-pink-100 text-purple-600'
                                                    : 'bg-slate-100 text-slate-500'
                                            }
                                        `}>
                                            {pkg.credits}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-slate-800">{pkg.name}</p>
                                            <p className="text-sm text-slate-500 font-medium">{pkg.credits} credits</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-slate-800">₹{pkg.amount_rupees}</p>
                                            <p className="text-xs text-slate-400 font-medium">
                                                ₹{(pkg.amount_rupees / pkg.credits).toFixed(2)}/credit
                                            </p>
                                        </div>
                                        {purchasing === pkg.id ? (
                                            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* No packages */}
                    {!loading && !error && packages.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-slate-400">No packages available at the moment.</p>
                        </div>
                    )}
                </div>

                {/* Footer - Fixed */}
                <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-white rounded-b-3xl">
                    <p className="text-xs text-slate-400 text-center font-medium">
                        Secure payments powered by Razorpay. By purchasing, you agree to our terms of service.
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BuyCreditsModal;
