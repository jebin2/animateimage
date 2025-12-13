import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon, AlertCircleIcon, CreditCardIcon } from './Icons';
import { GoogleUser } from '../services/googleAuthService';
import CustomGoogleSignInButton from './CustomGoogleSignInButton';
import UserAvatar from './UserAvatar';

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

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Load stored preferences
      const storedKey = localStorage.getItem('gemini_api_key');
      const storedUseCredits = localStorage.getItem('use_credits_preference');

      setKey(storedKey || '');
      setValidationError(null);

      // Priority: stored preference > has API key > signed in user > default off
      if (storedUseCredits !== null) {
        // User has a saved preference
        setUseCredit(storedUseCredits === 'true');
      } else if (storedKey) {
        // Has API key, default to using it
        setUseCredit(false);
      } else if (user) {
        // No key but signed in, default to credits
        setUseCredit(true);
      } else {
        setUseCredit(false);
      }
    }
  }, [isOpen, user]);

  // Render Google button when needed
  // Removed direct renderGoogleButton effect as it's now handled by CustomGoogleSignInButton

  const handleUseCreditChange = (checked: boolean) => {
    setUseCredit(checked);
    setValidationError(null);
    // Persist preference
    localStorage.setItem('use_credits_preference', checked.toString());
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-white border border-white/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-md shadow-2xl shadow-purple-100/50 scale-100 animate-in zoom-in-95 duration-300 max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 text-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-tr from-cute-pink to-cute-purple rounded-lg sm:rounded-xl flex items-center justify-center shadow-md shadow-pink-100">
              <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold font-display">Settings</h2>
          </div>
          {user && useCredit && (
            <div className="bg-purple-50 text-purple-600 px-3 py-1 rounded-full text-xs font-bold border border-purple-100">
              {user.credits} Credits
            </div>
          )}
        </div>

        {/* Error Message */}
        {(errorMessage || validationError) && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-2 max-h-32 overflow-y-auto">
            <AlertCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 font-medium break-all">
              {validationError || errorMessage}
            </p>
          </div>
        )}

        {/* Use Credit Checkbox */}
        <div
          className={`mb-6 flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${useCredit ? 'bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
          onClick={() => handleUseCreditChange(!useCredit)}
        >
          {/* Custom Checkbox */}
          <div className={`relative w-5 h-5 rounded-lg border-2 transition-all duration-300 flex items-center justify-center shrink-0 ${useCredit ? 'bg-gradient-to-r from-cute-pink to-cute-purple border-pink-300' : 'bg-white border-slate-300'}`}>
            {useCredit && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <input
            type="checkbox"
            id="useCredit"
            checked={useCredit}
            onChange={(e) => handleUseCreditChange(e.target.checked)}
            className="hidden"
          />
          <div className="flex items-center gap-2 flex-1 select-none">
            <CreditCardIcon className={`w-5 h-5 ${useCredit ? 'text-pink-500' : 'text-slate-600'}`} />
            <label htmlFor="useCredit" className={`text-sm font-extrabold cursor-pointer ${useCredit ? 'text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500' : 'text-slate-700'}`}>
              Use Credits
            </label>
          </div>
          {user && useCredit && (
            <span className="text-xs text-green-500 font-bold flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full shadow-sm"></span>
              Signed in
            </span>
          )}
        </div>

        {/* Content based on state */}
        {useCredit ? (
          // Credit system selected
          user ? (
            // User is signed in - show confirmation
            <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={user.profilePicture}
                  name={user.name}
                  email={user.email}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 font-bold truncate">{user.name || 'User'}</p>
                  <p className="text-sm text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                You'll use credits from your account for image generation.
              </p>
            </div>
          ) : (
            // Not signed in - show Google Sign-In button
            <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-slate-500 text-sm mb-4 text-center font-medium">
                Sign in with Google to use the credit system
              </p>
              <div className="flex justify-center">
                <div className="p-[2px] rounded-full bg-gradient-to-r from-cute-pink to-cute-purple shadow-md hover:shadow-lg hover:shadow-pink-200 transition-all duration-300 hover:scale-[1.02]">
                  <div className="bg-white rounded-full overflow-hidden">
                    <CustomGoogleSignInButton width="280px" />
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          // API Key input
          <div className="space-y-2 mb-6">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Gemini API Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIzaSy..."
              className={`w-full bg-slate-50 border rounded-2xl p-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${errorMessage ? 'border-red-200 focus:ring-red-100' : 'border-slate-200 focus:ring-purple-100 focus:border-purple-300'}`}
              autoFocus
            />
            <p className="text-xs text-slate-500 ml-1">
              Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-purple-500 hover:text-purple-600 hover:underline font-bold">Get one here</a>
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors font-bold text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit()}
            className="px-6 py-2.5 bg-gradient-to-r from-cute-pink to-cute-purple hover:shadow-lg hover:shadow-pink-200 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all duration-300 hover:scale-105 active:scale-95"
          >
            {errorMessage ? 'Retry' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;