import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  subMessage?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message, subMessage }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 animate-in fade-in duration-300">
      <div className="relative">
        <div className="w-12 h-12 rounded-full absolute border-4 border-solid border-pink-100"></div>
        <div className="w-12 h-12 rounded-full animate-spin absolute border-4 border-solid border-purple-500 border-t-transparent shadow-md shadow-purple-200"></div>
        <div className="w-12 h-12"></div>
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-slate-700">{message || "Processing..."}</p>
        {subMessage && (
          <p className="text-sm text-slate-500 mt-1 max-w-xs font-medium">{subMessage}</p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;