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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white border border-white/60 rounded-3xl shadow-2xl shadow-purple-100/50 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex-shrink-0 p-6 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 rounded-t-3xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                <MessageIcon className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold font-display text-slate-800">Contact Us</h2>
                                <p className="text-sm text-slate-500 font-medium">We'd love to hear from you</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/50 transition-all duration-300 hover:rotate-90 text-slate-400 hover:text-slate-600"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {/* Error State */}
                    {error && (
                        <div className="flex items-center gap-3 p-4 mb-4 bg-red-50 border border-red-100 rounded-2xl">
                            <AlertCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
                            <p className="text-red-600 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Success State */}
                    {successMessage && (
                        <div className="flex items-center gap-3 p-4 mb-4 bg-green-50 border border-green-100 rounded-2xl">
                            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <p className="text-green-600 text-sm font-medium">{successMessage}</p>
                        </div>
                    )}

                    {/* Subject Field */}
                    <div className="mb-4">
                        <label htmlFor="subject" className="block text-sm font-bold text-slate-600 mb-2 ml-1">
                            Subject <span className="text-slate-400 font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            id="subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="What's this about?"
                            disabled={submitting}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 transition-all duration-300 focus:scale-[1.01] disabled:opacity-50 shadow-sm"
                        />
                    </div>

                    {/* Message Field */}
                    <div className="mb-6">
                        <label htmlFor="message" className="block text-sm font-bold text-slate-600 mb-2 ml-1">
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
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 transition-all duration-300 focus:scale-[1.01] disabled:opacity-50 resize-none shadow-sm"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={submitting || !message.trim()}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-400 to-teal-400 hover:shadow-lg hover:shadow-emerald-200 text-white font-bold rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-white rounded-b-3xl">
                    <p className="text-xs text-slate-400 text-center font-medium">
                        We typically respond within 24-48 hours.
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ContactModal;
