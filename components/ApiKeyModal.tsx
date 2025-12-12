import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon, AlertCircleIcon, CreditCardIcon } from './Icons';
import { GoogleUser, renderGoogleButton } from '../services/googleAuthService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (key: string) => void;
  errorMessage?: string;
  user: GoogleUser | null;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSubmit, errorMessage, user }) => {
  const [key, setKey] = useState('');
  const [useCredit, setUseCredit] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const googleButtonContainerRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setKey('');
      setValidationError(null);
      // If user is signed in, auto-check the credit option
      if (user) {
        setUseCredit(true);
      } else {
        setUseCredit(false);
      }
    }
  }, [isOpen, user]);

  // Render Google button when needed
  useEffect(() => {
    if (isOpen && !user && useCredit && googleButtonContainerRef.current) {
      const timer = setTimeout(() => {
        if (googleButtonContainerRef.current) {
          // Clear previous button
          googleButtonContainerRef.current.innerHTML = '';
          try {
            renderGoogleButton(googleButtonContainerRef.current, {
              theme: 'filled_black',
              size: 'large',
              text: 'signin_with',
              shape: 'pill',
              width: 280
            });
          } catch (e) {
            console.error('Failed to render Google button:', e);
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, user, useCredit]);

  const handleUseCreditChange = (checked: boolean) => {
    setUseCredit(checked);
    setValidationError(null);
  };

  const handleSubmit = () => {
    if (useCredit && user) {
      // User is using credits with Google Sign-In - pass special marker
      onSubmit('USE_CREDITS');
    } else if (!useCredit && key.trim()) {
      // User is using their own API key
      onSubmit(key.trim());
    }
  };

  const canSubmit = () => {
    if (useCredit) {
      return !!user; // Can submit if signed in
    }
    return !!key.trim(); // Can submit if API key provided
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold">Settings</h2>
          </div>
          {user && useCredit && (
            <div className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-medium border border-indigo-500/30">
              {user.credits} Credits
            </div>
          )}
        </div>

        {/* Error Message */}
        {(errorMessage || validationError) && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-start gap-2 max-h-32 overflow-y-auto">
            <AlertCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200 font-medium break-all">
              {validationError || errorMessage}
            </p>
          </div>
        )}

        {/* Use Credit Checkbox */}
        <div className={`mb-6 flex items-center gap-3 p-3 rounded-xl border transition-colors ${useCredit ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-slate-950/50 border-slate-800 hover:bg-slate-900/50'}`}>
          <input
            type="checkbox"
            id="useCredit"
            checked={useCredit}
            onChange={(e) => handleUseCreditChange(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
          />
          <div className="flex items-center gap-2 flex-1 cursor-pointer select-none" onClick={() => handleUseCreditChange(!useCredit)}>
            <CreditCardIcon className={`w-4 h-4 ${useCredit ? 'text-indigo-400' : 'text-slate-500'}`} />
            <label htmlFor="useCredit" className={`text-sm font-medium cursor-pointer ${useCredit ? 'text-indigo-200' : 'text-slate-300'}`}>
              Use Credit System
            </label>
          </div>
          {user && useCredit && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              Signed in
            </span>
          )}
        </div>

        {/* Content based on state */}
        {useCredit ? (
          // Credit system selected
          user ? (
            // User is signed in - show confirmation
            <div className="mb-6 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3">
                {user.profilePicture ? (
                  <img src={user.profilePicture} alt={user.name || user.email} className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
                    {(user.name || user.email)[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{user.name || 'User'}</p>
                  <p className="text-sm text-slate-400 truncate">{user.email}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                You'll use credits from your account for image generation.
              </p>
            </div>
          ) : (
            // Not signed in - show Google Sign-In button
            <div className="mb-6 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
              <p className="text-slate-400 text-sm mb-4 text-center">
                Sign in with Google to use the credit system
              </p>
              <div ref={googleButtonContainerRef} className="flex justify-center">
                {/* Google button rendered here */}
              </div>
            </div>
          )
        ) : (
          // API Key input
          <div className="space-y-2 mb-6">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Gemini API Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIzaSy..."
              className={`w-full bg-slate-950 border rounded-xl p-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${errorMessage ? 'border-red-500/50 focus:ring-red-500/50' : 'border-slate-700 focus:ring-indigo-500/50'}`}
              autoFocus
            />
            <p className="text-xs text-slate-500">
              Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline">Get one here</a>
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all text-sm shadow-lg shadow-indigo-500/20"
          >
            {errorMessage ? 'Retry' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;