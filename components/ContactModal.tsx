import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { submitContactForm } from '../services/contactService';
import { MessageIcon, AlertCircleIcon } from './Icons';

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!message.trim()) {
            setError('Message is required.');
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        const result = await submitContactForm({
            subject: subject.trim() || undefined,
            message: message.trim()
        });

        setSubmitting(false);

        if (result.success && result.data) {
            setSuccessMessage(result.data.message);
            setSubject('');
            setMessage('');
        } else {
            setError(result.error || 'Failed to send message.');
        }
    };

    const handleClose = () => {
        setSubject('');
        setMessage('');
        setError(null);
        setSuccessMessage(null);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex-shrink-0 p-6 border-b border-slate-700 bg-gradient-to-r from-emerald-950/50 to-teal-950/50 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                <MessageIcon className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Contact Us</h2>
                                <p className="text-sm text-slate-400">We'd love to hear from you</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
                    {/* Error State */}
                    {error && (
                        <div className="flex items-center gap-3 p-4 mb-4 bg-red-950/30 border border-red-500/30 rounded-xl">
                            <AlertCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
                            <p className="text-red-300 text-sm">{error}</p>
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

                    {/* Subject Field */}
                    <div className="mb-4">
                        <label htmlFor="subject" className="block text-sm font-medium text-slate-300 mb-2">
                            Subject <span className="text-slate-500">(optional)</span>
                        </label>
                        <input
                            type="text"
                            id="subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="What's this about?"
                            disabled={submitting}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors disabled:opacity-50"
                        />
                    </div>

                    {/* Message Field */}
                    <div className="mb-6">
                        <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-2">
                            Message <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            id="message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Tell us what you need help with..."
                            required
                            disabled={submitting}
                            rows={5}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors disabled:opacity-50 resize-none"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={submitting || !message.trim()}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <MessageIcon className="w-5 h-5" />
                                Send Message
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="flex-shrink-0 px-6 py-4 border-t border-slate-700/50 bg-slate-800/30 rounded-b-2xl">
                    <p className="text-xs text-slate-500 text-center">
                        We typically respond within 24-48 hours.
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ContactModal;
