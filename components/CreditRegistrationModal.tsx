import React, { useState, useEffect } from 'react';
import { SparklesIcon, AlertCircleIcon } from './Icons';
import { authService, AuthResponse } from '../services/authService';

interface CreditRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onForgotKey: (email: string) => void;
}

const CreditRegistrationModal: React.FC<CreditRegistrationModalProps> = ({ isOpen, onClose, onSuccess, onForgotKey }) => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<AuthResponse | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [resendTimer, setResendTimer] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (resendTimer > 0) {
            interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!email.trim()) return;

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        const response = await authService.register(email);

        setIsLoading(false);
        if (response.success) {
            setSuccessMessage(response.message || 'Secret key sent to your email.');
            setResendTimer(60); // Start 60s timer for resend
        } else {
            if (response.message === 'Email already registered') {
                onSuccess();
                return;
            }
            setError(response);
        }
    };

    const handleResend = async () => {
        if (resendTimer > 0) return;
        await handleSubmit();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-white/60 rounded-3xl p-6 w-full max-w-md shadow-2xl shadow-purple-100/50 scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <SparklesIcon className="w-5 h-5 text-purple-400" />
                    </div>
                    <h2 className="text-xl font-bold font-display text-slate-800">Credit System Registration</h2>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-start gap-2">
                            <AlertCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600 font-medium">{error.message}</p>
                        </div>
                        {error.errorType === 'RATE_LIMIT' && (
                            <p className="text-xs text-red-500 pl-7 font-medium">Please wait before trying again.</p>
                        )}

                    </div>
                )}

                {successMessage ? (
                    <div className="mb-6 p-6 bg-green-50 border border-green-100 rounded-2xl text-center animate-in fade-in slide-in-from-bottom-2">
                        <p className="text-green-700 font-bold text-lg mb-2">Check your email!</p>
                        <p className="text-slate-600 text-sm mb-6 font-medium">{successMessage}</p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={onSuccess}
                                className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-colors text-sm shadow-lg shadow-green-200"
                            >
                                I have the key
                            </button>
                            <div className="text-xs text-slate-500 mt-2 font-medium">
                                Didn't receive it?{' '}
                                {resendTimer > 0 ? (
                                    <span className="text-slate-400">Resend in {resendTimer}s</span>
                                ) : (
                                    <button onClick={handleResend} className="text-purple-500 hover:text-purple-600 hover:underline font-bold">Resend Email</button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-slate-500 text-sm mb-6 leading-relaxed font-medium">
                            Enter your email to receive a secret key. This key allows you to use the credit system.
                        </p>

                        <div className="space-y-2 mb-8">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-300 transition-all shadow-sm"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors font-bold text-sm"
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!email.trim() || isLoading}
                                className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all text-sm flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {isLoading ? 'Sending...' : (error ? 'Retry' : 'Generate Key')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CreditRegistrationModal;
