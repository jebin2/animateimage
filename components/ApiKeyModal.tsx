import React, { useState, useEffect } from 'react';
import { SparklesIcon, AlertCircleIcon, TrashIcon } from './Icons';
import { checkKey, NO_VEO } from '../services/geminiService';
import { showWarning } from '../services/toastService';

interface ApiKeyModalProps {
  isOpen: boolean;
  initialKey: string;
  initialRemember: boolean;
  onClose: () => void;
  onSave: (key: string, remember: boolean) => void;
  onForget: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, initialKey, initialRemember, onClose, onSave, onForget }) => {
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setKey(initialKey);
      setRemember(initialKey ? initialRemember : true);
      setShow(false);
      setError(null);
    }
  }, [isOpen, initialKey, initialRemember]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const k = key.trim();
    if (!k) return;
    setChecking(true);
    setError(null);
    try {
      const models = await checkKey(k);
      if (!models.video) showWarning(NO_VEO, 12000);
      onSave(k, remember);
    } catch (e: any) {
      setError(e?.message || 'Could not check the key.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div
        className="bg-white border border-white/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-md shadow-2xl shadow-purple-100/50 animate-in zoom-in-95 duration-300 max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4 text-slate-800">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-tr from-cute-pink to-cute-purple rounded-lg sm:rounded-xl flex items-center justify-center shadow-md shadow-pink-100">
            <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold font-display">Your Gemini API key</h2>
        </div>

        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          AnimateImage runs in your browser with your own key. The key and your images go
          only to Google; there is no AnimateImage server. Use is billed to your Google
          project, and video (Veo) needs billing turned on.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-2">
            <AlertCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-2 mb-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={key}
              onChange={e => { setKey(e.target.value); setError(null); }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="AIzaSy…"
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-16 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-300 transition-all"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-purple-500"
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-slate-500 ml-1">
            No key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-purple-500 hover:text-purple-600 hover:underline font-bold">Create one in Google AI Studio</a>
          </p>
        </div>

        <label className="flex items-start gap-3 mb-6 cursor-pointer select-none">
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="mt-1 accent-purple-500" />
          <span className="text-sm text-slate-600">
            <span className="font-bold text-slate-700">Remember on this device.</span>{' '}
            Off: forgotten when you close the tab. Don't tick this on a shared computer.
          </span>
        </label>

        <div className="flex gap-3 justify-between items-center">
          {initialKey ? (
            <button
              onClick={() => { onForget(); setKey(''); }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50 transition-colors font-bold text-sm"
            >
              <TrashIcon className="w-4 h-4" /> Forget key
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors font-bold text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!key.trim() || checking}
              className="px-6 py-2.5 bg-gradient-to-r from-cute-pink to-cute-purple hover:shadow-lg hover:shadow-pink-200 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all duration-300 hover:scale-105 active:scale-95"
            >
              {checking ? 'Checking…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
