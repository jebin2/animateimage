import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  subMessage?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message, subMessage }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 animate-in fade-in duration-300">
      <div className="relative">
        <div className="w-12 h-12 rounded-full absolute border-4 border-solid border-gray-600"></div>
        <div className="w-12 h-12 rounded-full animate-spin absolute border-4 border-solid border-indigo-500 border-t-transparent shadow-md"></div>
        <div className="w-12 h-12"></div>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-200">{message || "Processing..."}</p>
        {subMessage && (
          <p className="text-sm text-slate-400 mt-1 max-w-xs">{subMessage}</p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;