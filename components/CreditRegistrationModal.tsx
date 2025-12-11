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
            setError(response);
        }
    };

    const handleResend = async () => {
        if (resendTimer > 0) return;
        await handleSubmit();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 mb-4 text-white">
                    <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                        <SparklesIcon className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h2 className="text-xl font-bold">Credit System Registration</h2>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex flex-col gap-2">
                        <div className="flex items-start gap-2">
                            <AlertCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-200 font-medium">{error.message}</p>
                        </div>
                        {error.errorType === 'RATE_LIMIT' && (
                            <p className="text-xs text-red-300 pl-7">Please wait before trying again.</p>
                        )}
                        {error.message === 'Email already registered' && (
                            <button
                                onClick={() => onForgotKey(email)}
                                className="text-xs text-indigo-300 hover:text-indigo-200 underline pl-7 text-left"
                            >
                                Forgot your secret key? Reset it here.
                            </button>
                        )}
                    </div>
                )}

                {successMessage ? (
                    <div className="mb-6 p-4 bg-green-900/20 border border-green-900/50 rounded-lg text-center animate-in fade-in slide-in-from-bottom-2">
                        <p className="text-green-200 font-medium text-lg mb-2">Check your email!</p>
                        <p className="text-slate-400 text-sm mb-4">{successMessage}</p>

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={onSuccess}
                                className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors text-sm"
                            >
                                I have the key
                            </button>
                            <div className="text-xs text-slate-500 mt-2">
                                Didn't receive it?{' '}
                                {resendTimer > 0 ? (
                                    <span className="text-slate-400">Resend in {resendTimer}s</span>
                                ) : (
                                    <button onClick={handleResend} className="text-indigo-400 hover:underline">Resend Email</button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                            Enter your email to receive a secret key. This key allows you to use the credit system.
                        </p>

                        <div className="space-y-2 mb-6">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-medium text-sm"
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!email.trim() || isLoading}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all text-sm shadow-lg shadow-indigo-500/20 flex items-center gap-2"
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
