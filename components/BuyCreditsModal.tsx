import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CreditPackage, getPackages, purchaseCredits, PaymentVerificationResult } from '../services/razorpayService';
import { fetchUserInfo, GoogleUser } from '../services/googleAuthService';
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
    const [error, setError] = useState<string | null>(null);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Fetch packages on mount
    useEffect(() => {
        if (isOpen) {
            // Reset state when modal opens
            setSuccessMessage(null);
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
        setSuccessMessage(null);

        await purchaseCredits({
            packageId: pkg.id,
            appName: 'AnimateImage',
            userEmail: user.email,
            userName: user.name || undefined,
            onSuccess: async (result: PaymentVerificationResult) => {
                setPurchasing(null);
                setSuccessMessage(`Success, New balance: ${result.new_balance}`);

                // Refresh user info to update credits display
                await fetchUserInfo();
                onCreditsUpdated?.(result.new_balance);

                // User can close the modal manually via the close icon
            },
            onError: (errorMsg: string) => {
                setPurchasing(null);
                setError(errorMsg);
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
            <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header - Fixed */}
                <div className="flex-shrink-0 p-6 border-b border-slate-700 bg-gradient-to-r from-indigo-950/50 to-purple-950/50 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                                <SparklesIcon className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Buy Credits</h2>
                                <p className="text-sm text-slate-400">Choose a credit package</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Current Balance */}
                    <div className="flex items-center gap-3 p-4 mb-6 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <CreditCardIcon className="w-5 h-5 text-indigo-400" />
                        <span className="text-slate-400">Current Balance:</span>
                        <span className="font-bold text-indigo-300">{user.credits} credits</span>
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

                    {/* Success State */}
                    {successMessage && (
                        <div className="flex items-center gap-3 p-4 mb-4 bg-green-950/30 border border-green-500/30 rounded-xl">
                            <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <p className="text-green-300 text-sm">{successMessage}</p>
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
                                        w-full flex items-center justify-between p-4 rounded-xl border transition-all
                                        ${purchasing === pkg.id
                                            ? 'bg-indigo-950/50 border-indigo-500 cursor-wait'
                                            : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-indigo-500/50 cursor-pointer'
                                        }
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    `}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`
                                            w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg
                                            ${pkg.id === 'pro'
                                                ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400'
                                                : pkg.id === 'standard'
                                                    ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400'
                                                    : 'bg-slate-700/50 text-slate-400'
                                            }
                                        `}>
                                            {pkg.credits}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-semibold text-white">{pkg.name}</p>
                                            <p className="text-sm text-slate-400">{pkg.credits} credits</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-white">₹{pkg.amount_rupees}</p>
                                            <p className="text-xs text-slate-500">
                                                ₹{(pkg.amount_rupees / pkg.credits).toFixed(2)}/credit
                                            </p>
                                        </div>
                                        {purchasing === pkg.id ? (
                                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div className="flex-shrink-0 px-6 py-4 border-t border-slate-700/50 bg-slate-800/30 rounded-b-2xl">
                    <p className="text-xs text-slate-500 text-center">
                        Secure payments powered by Razorpay. By purchasing, you agree to our terms of service.
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BuyCreditsModal;
