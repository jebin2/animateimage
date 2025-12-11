import React, { useState, useEffect } from 'react';
import { SparklesIcon, AlertCircleIcon, CreditCardIcon } from './Icons';
import { authService, AuthResponse } from '../services/authService';
import { updateUserId, saveCredits, getCredits } from '../services/userIdService';
import CreditRegistrationModal from './CreditRegistrationModal';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (key: string) => void;
  errorMessage?: string;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSubmit, errorMessage }) => {
  const [key, setKey] = useState('');
  const [useCredit, setUseCredit] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<AuthResponse | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  // Auto-fill logic on mount/open
  useEffect(() => {
    if (isOpen) {
      setKey('');
      setUseCredit(false);
      setIsRegistered(null);
      setValidationError(null);
      setShowReset(false);
      setResetMessage(null);
      setCredits(null);
    }
  }, [isOpen]);

  const handleUseCreditChange = async (checked: boolean) => {
    setUseCredit(checked);
    setValidationError(null);
    setShowReset(false);

    if (checked) {
      // If we already have a key, don't clear it, just validate
      if (!key) {
        setIsChecking(true);
        const registered = await authService.checkRegistration();
        setIsChecking(false);
        setIsRegistered(registered);

        if (!registered) {
          setShowRegistration(true);
        }
      }
    } else {
      // Unchecking clears credit-specific state but keeps key if user wants to switch back
      setCredits(null);
    }
  };

  const handleRegistrationSuccess = () => {
    setShowRegistration(false);
    setIsRegistered(true);
    setUseCredit(true);
  };

  const handleResetKey = async () => {
    if (!resetEmail.trim()) return;
    setIsValidating(true);
    const response = await authService.resetSecretKey(resetEmail);
    setIsValidating(false);

    if (response.success) {
      setResetMessage(response.message || 'New key sent to email.');
      setTimeout(() => {
        setShowReset(false);
        setResetMessage(null);
      }, 3000);
    } else {
      setValidationError(response);
      // If email not found, suggest registration
      if (response.errorType === 'NOT_FOUND') {
        // We could auto-open registration, but let's just show the error for now
        // or maybe add a button in the error UI
      }
    }
  };

  const handleSubmit = async () => {
    if (!key.trim()) return;

    if (useCredit) {
      // Format validation
      if (!key.trim().startsWith('sk_')) {
        setValidationError({ success: false, message: 'Invalid format. Key must start with "sk_"', errorType: 'UNKNOWN' });
        return;
      }

      setIsValidating(true);
      setValidationError(null);
      const response = await authService.validateSecretKey(key.trim());
      setIsValidating(false);

      if (response.success && response.user_id) {
        await updateUserId(response.user_id);
        // await saveSecretKey(key.trim()); // Removed persistence
        if (response.credits !== undefined) {
          await saveCredits(response.credits);
          setCredits(response.credits);
        }
        onSubmit(key.trim());
      } else {
        setValidationError(response);
      }
    } else {
      onSubmit(key.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-4 text-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold">
                {useCredit ? 'Enter Secret Key' : 'Enter API Key'}
              </h2>
            </div>
            {credits !== null && useCredit && (
              <div className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-medium border border-indigo-500/30">
                {credits} Credits
              </div>
            )}
          </div>

          {(errorMessage || validationError) && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex flex-col gap-2 max-h-32 overflow-y-auto">
              <div className="flex items-start gap-2">
                <AlertCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200 font-medium break-all">
                  {validationError?.message || errorMessage}
                </p>
              </div>
              {validationError?.errorType === 'NOT_FOUND' && showReset && (
                <button onClick={() => setShowRegistration(true)} className="text-xs text-red-300 underline self-start ml-7">
                  Email not found? Register here.
                </button>
              )}
            </div>
          )}

          {!errorMessage && !validationError && !showReset && (
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              {useCredit
                ? "Enter your secret key to use the credit system."
                : "Please enter your API key to continue. The key is used only for this session."}
            </p>
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
            {isChecking && <span className="text-xs text-indigo-400 animate-pulse">Checking...</span>}
          </div>

          {showReset ? (
            <div className="space-y-4 mb-6 animate-in slide-in-from-right-4 duration-200">
              <p className="text-sm text-slate-400">Enter your email to receive a new secret key.</p>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                autoFocus
              />
              {resetMessage && <p className="text-green-400 text-sm">{resetMessage}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowReset(false)}
                  className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetKey}
                  disabled={isValidating || !resetEmail.trim()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {isValidating ? 'Sending...' : 'Send New Key'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 mb-6">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {useCredit ? 'Secret Key' : 'API Key'}
                </label>
                {useCredit && (
                  <button
                    onClick={() => setShowReset(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
                  >
                    Forgot Key?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={useCredit ? "sk_..." : "AIzaSy..."}
                className={`w-full bg-slate-950 border rounded-xl p-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${(errorMessage || validationError) ? 'border-red-500/50 focus:ring-red-500/50' : 'border-slate-700 focus:ring-indigo-500/50'
                  }`}
                autoFocus
                disabled={useCredit && !isRegistered && !key} // Disable if not registered AND no key pre-filled
              />
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            {!showReset && (
              <button
                onClick={handleSubmit}
                disabled={!key.trim() || isValidating || (useCredit && !isRegistered && !key)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all text-sm shadow-lg shadow-indigo-500/20"
              >
                {isValidating ? 'Validating...' : (errorMessage || validationError ? 'Retry' : 'Start AnimateImage')}
              </button>
            )}
          </div>

          {!useCredit && (
            <div className="mt-6 text-center border-t border-slate-800/50 pt-4">
              <p className="text-xs text-slate-500">
                Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline">Get one here</a>
              </p>
            </div>
          )}
        </div>
      </div>

      <CreditRegistrationModal
        isOpen={showRegistration}
        onClose={() => {
          setShowRegistration(false);
          // If they close without registering, uncheck the box
          if (!isRegistered) setUseCredit(false);
        }}
        onSuccess={handleRegistrationSuccess}
        onForgotKey={(email) => {
          setShowRegistration(false);
          setResetEmail(email);
          setShowReset(true);
        }}
      />
    </>
  );
};

export default ApiKeyModal;