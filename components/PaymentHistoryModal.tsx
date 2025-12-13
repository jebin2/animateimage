import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    getPaymentHistory,
    PaymentTransaction,
    formatAmount,
    getStatusColor,
    formatDate
} from '../services/paymentHistoryService';
import { HistoryIcon, AlertCircleIcon, CreditCardIcon } from './Icons';

interface PaymentHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({ isOpen, onClose }) => {
    const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [limit] = useState(10);

    useEffect(() => {
        if (isOpen) {
            loadHistory(1);
        }
    }, [isOpen]);

    const loadHistory = async (pageNum: number) => {
        setLoading(true);
        setError(null);

        const result = await getPaymentHistory(pageNum, limit);

        if (result.success && result.data) {
            setTransactions(result.data.transactions);
            setTotalCount(result.data.total_count);
            setPage(result.data.page);
        } else {
            setError(result.error || 'Failed to load payment history');
        }

        setLoading(false);
    };

    const totalPages = Math.ceil(totalCount / limit);

    const handlePrevPage = () => {
        if (page > 1) {
            loadHistory(page - 1);
        }
    };

    const handleNextPage = () => {
        if (page < totalPages) {
            loadHistory(page + 1);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex-shrink-0 p-6 border-b border-slate-700 bg-gradient-to-r from-violet-950/50 to-purple-950/50 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
                                <HistoryIcon className="w-5 h-5 text-violet-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Payment History</h2>
                                <p className="text-sm text-slate-400">Your transactions and purchases</p>
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

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Loading State */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-slate-400">Loading transactions...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && !loading && (
                        <div className="flex items-center gap-3 p-4 bg-red-950/30 border border-red-500/30 rounded-xl">
                            <AlertCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
                            <p className="text-red-300 text-sm">{error}</p>
                            <button
                                onClick={() => loadHistory(page)}
                                className="ml-auto text-sm text-red-400 hover:text-red-300 underline"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && !error && transactions.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <CreditCardIcon className="w-8 h-8 text-slate-500" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">No Transactions Yet</h3>
                            <p className="text-slate-400 max-w-xs">
                                Your payment history will appear here once you make a purchase.
                            </p>
                        </div>
                    )}

                    {/* Transaction List */}
                    {!loading && !error && transactions.length > 0 && (
                        <div className="space-y-3">
                            {transactions.map((tx) => (
                                <div
                                    key={tx.transaction_id}
                                    className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:bg-slate-800/80 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-white capitalize">
                                                    {tx.package_id} Package
                                                </span>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(tx.status)}`}>
                                                    {tx.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-400 mb-2">
                                                {tx.credits_amount} credits
                                            </p>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                                <span>
                                                    {formatDate(tx.paid_at || tx.created_at)}
                                                </span>
                                                {tx.razorpay_payment_id && (
                                                    <span className="font-mono">
                                                        {tx.razorpay_payment_id}
                                                    </span>
                                                )}
                                            </div>
                                            {tx.error_message && (
                                                <p className="mt-2 text-xs text-red-400">
                                                    {tx.error_message}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-lg font-bold text-white">
                                                {formatAmount(tx.amount_paise, tx.currency)}
                                            </p>
                                            <p className="text-xs text-slate-500 capitalize">
                                                {tx.gateway}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer with Pagination */}
                {!loading && !error && transactions.length > 0 && (
                    <div className="flex-shrink-0 px-6 py-4 border-t border-slate-700/50 bg-slate-800/30 rounded-b-2xl">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-400">
                                Showing {(page - 1) * limit + 1}-{Math.min(page * limit, totalCount)} of {totalCount}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrevPage}
                                    disabled={page <= 1}
                                    className="px-3 py-1.5 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-slate-400 px-2">
                                    {page} / {totalPages}
                                </span>
                                <button
                                    onClick={handleNextPage}
                                    disabled={page >= totalPages}
                                    className="px-3 py-1.5 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer for empty/error states */}
                {!loading && (transactions.length === 0 || error) && (
                    <div className="flex-shrink-0 px-6 py-4 border-t border-slate-700/50 bg-slate-800/30 rounded-b-2xl">
                        <p className="text-xs text-slate-500 text-center">
                            Need help? Contact our support team.
                        </p>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default PaymentHistoryModal;
