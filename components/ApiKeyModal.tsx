import React, { useState } from 'react';
import { SparklesIcon, AlertCircleIcon } from './Icons';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (key: string) => void;
  errorMessage?: string;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSubmit, errorMessage }) => {
  const [key, setKey] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 mb-4 text-white">
          <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
            <SparklesIcon className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold">Enter API Key</h2>
        </div>

        {errorMessage ? (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-start gap-2 max-h-32 overflow-y-auto">
            <AlertCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200 font-medium break-all">{errorMessage}</p>
          </div>
        ) : (
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Please enter your API key to continue. The key is used only for this session and is not stored permanently.
          </p>
        )}

        <div className="space-y-2 mb-6">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">API Key</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIzaSy..."
            className={`w-full bg-slate-950 border rounded-xl p-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${errorMessage ? 'border-red-500/50 focus:ring-red-500/50' : 'border-slate-700 focus:ring-indigo-500/50'
              }`}
            autoFocus
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (key.trim()) onSubmit(key.trim()); }}
            disabled={!key.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all text-sm shadow-lg shadow-indigo-500/20"
          >
            {errorMessage ? 'Retry' : 'Start AnimateImage'}
          </button>
        </div>

        <div className="mt-6 text-center border-t border-slate-800/50 pt-4">
          <p className="text-xs text-slate-500">
            Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline">Get one here</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;