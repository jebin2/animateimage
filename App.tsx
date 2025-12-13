import React, { useState, useRef, useEffect } from 'react';
import { AppMode, ProcessingState, AspectRatio } from './types';
import { editImage, generateVideo, generateAnimationPrompt, GeminiOptions } from './services/geminiService';
import { initUsage, recordUsage } from './services/usageService';
import { UploadIcon, VideoIcon, WandIcon, TrashIcon, AlertCircleIcon, SparklesIcon, SettingsIcon } from './components/Icons';
import CustomGoogleSignInButton from './components/CustomGoogleSignInButton';
import LoadingSpinner from './components/LoadingSpinner';
import ApiKeyModal from './components/ApiKeyModal';
import UserProfileMenu from './components/UserProfileMenu';
import ToastContainer from './components/ToastContainer';
import { showError } from './services/toastService';
import { GoogleUser, initializeAuth, initGoogleAuth, onAuthStateChange, isAuthenticated } from './services/googleAuthService';


const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string>('');
  const [pendingAutoGenerate, setPendingAutoGenerate] = useState<boolean>(false);

  const [mode, setMode] = useState<AppMode>('animate'); // Default to animate (Veo) as per user request
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [isAutoPrompt, setIsAutoPrompt] = useState<boolean>(false); // Track if prompt was AI generated
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');

  const [processing, setProcessing] = useState<ProcessingState>({
    isLoading: false,
    statusMessage: '',
  });

  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth state
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Load API key from local storage on mount and init usage and auth
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }

    // Initialize usage
    initUsage().catch(console.error);

    // Initialize auth
    const initAuth = async () => {
      try {
        const authenticatedUser = await initializeAuth();
        if (authenticatedUser) {
          setUser(authenticatedUser);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();

    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChange((newUser) => {
      setUser(newUser);
    });

    return () => unsubscribe();
  }, []);

  // Render Google button when not authenticated and container is available
  // Removed direct renderGoogleButton effect as it's now handled by CustomGoogleSignInButton

  const executeGeneration = async (options: GeminiOptions) => {
    // Reset previous results
    setResultImage(null);
    setResultVideo(null);
    setProcessing({ isLoading: true, statusMessage: 'Initializing...' });
    setModalError('');

    // Status callback to update UI
    const onStatus = (message: string) => {
      setProcessing(prev => ({ ...prev, statusMessage: message }));
    };

    try {
      if (mode === 'edit') {
        const editedImageBase64 = await editImage(selectedImage!, mimeType, prompt, { ...options, onStatus });
        setResultImage(editedImageBase64);
        recordUsage('generate_success', mode).catch(console.error);
        setProcessing({ isLoading: false, statusMessage: 'Done!' });
        // Credits are updated automatically from API response in geminiService
      } else {
        // Animation Logic
        let finalPrompt = prompt;

        // If prompt is empty, generate it using Gemini Vision (only for Client Mode)
        // For Credit Mode, we send empty prompt and let server generate it
        if (!finalPrompt.trim() && !options.useCredits) {
          try {
            finalPrompt = await generateAnimationPrompt(selectedImage!, mimeType, { ...options, onStatus });
            setPrompt(finalPrompt);
            setIsAutoPrompt(true);
          } catch (err) {
            console.warn("Failed to generate prompt", err);
            finalPrompt = "Animate this image with cinematic movement";
            setPrompt(finalPrompt);
          }
        }

        const videoUrl = await generateVideo(selectedImage!, mimeType, finalPrompt, {
          ...options,
          aspectRatio,
          onStatus
        });
        setResultVideo(videoUrl);
        recordUsage('generate_success', mode).catch(console.error);
        setProcessing({ isLoading: false, statusMessage: 'Done!' });
        // Credits are updated automatically from API response in geminiService
      }
    } catch (error: any) {
      console.error(error);

      // Record failure
      recordUsage('generate_failure', mode).catch(() => { });

      const errorMsg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));

      const isAuthOrNotFoundError =
        errorMsg.includes("API key") ||
        errorMsg.includes("403") ||
        errorMsg.includes("400") ||
        errorMsg.includes("404") ||
        errorMsg.includes("NOT_FOUND") ||
        errorMsg.includes("Requested entity was not found") ||
        errorMsg.includes("Model not found") ||
        errorMsg.includes("requires a paid account") ||
        errorMsg.includes("UNAUTHENTICATED") ||
        errorMsg.includes("[5,");

      if (isAuthOrNotFoundError) {
        setProcessing({ isLoading: false, statusMessage: '' });

        let friendlyMsg = errorMsg;
        if (errorMsg.includes("404") || errorMsg.includes("NOT_FOUND") || errorMsg.includes("Requested entity was not found") || errorMsg.includes("[5,")) {
          friendlyMsg = "Model or resource not found. This usually means your API Key does not have access to the required models (Requires Paid Project).";
        }

        // Show error as toast instead of opening modal
        showError(friendlyMsg);
      } else {
        setProcessing({
          isLoading: false,
          statusMessage: '',
          error: errorMsg || "An unexpected error occurred."
        });
      }
    }
  };

  const handleApiKeySubmit = (key: string) => {
    // Handle credit system marker
    if (key === 'USE_CREDITS') {
      // User chose to use credits
      setShowApiKeyModal(false);
      setModalError('');

      // Auto-generate if pending and user is signed in
      if (pendingAutoGenerate && selectedImage && user) {
        setPendingAutoGenerate(false);
        executeGeneration({ useCredits: true });
      }
      return;
    }

    setApiKey(key);
    localStorage.setItem('gemini_api_key', key); // Persist key
    setShowApiKeyModal(false);
    setModalError('');

    // Auto-generate if it was pending
    if (pendingAutoGenerate && selectedImage) {
      setPendingAutoGenerate(false);
      executeGeneration({ apiKey: key });
    }
  };

  const openSettings = () => {
    setModalError('');
    setPendingAutoGenerate(false);
    setShowApiKeyModal(true);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert("Please upload a valid image file.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        setSelectedImage(base64Data);
        setMimeType(file.type);
        setResultImage(null);
        setResultVideo(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateClick = () => {
    if (!selectedImage) return;

    // Record generate click
    recordUsage('generate_click', mode).catch(console.error);

    // Priority: API key > Credits > Show modal
    if (apiKey) {
      // Use API key (client-side mode)
      executeGeneration({ apiKey });
    } else if (user) {
      // Use credits (server-side mode)
      executeGeneration({ useCredits: true });
    } else {
      // No auth - show modal
      setPendingAutoGenerate(true);
      setShowApiKeyModal(true);
    }
  };

  const clearAll = () => {
    setSelectedImage(null);
    setMimeType('');
    setResultImage(null);
    setResultVideo(null);
    setPrompt('');
    setIsAutoPrompt(false);
    setProcessing({ isLoading: false, statusMessage: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const switchMode = (newMode: AppMode) => {
    setMode(newMode);
    setIsAutoPrompt(false);
  };

  return (
    <div className="min-h-screen max-h-screen bg-transparent text-slate-700 font-sans selection:bg-cute-pink selection:text-pink-900 relative flex flex-col">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/60 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="w-[95%] lg:w-[90%] mx-auto py-2 sm:py-0 sm:h-16 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
          {/* Logo - Hidden on very small screens, shown on sm+ */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-tr from-cute-pink to-cute-purple rounded-xl sm:rounded-2xl rotate-3 flex items-center justify-center shadow-lg shadow-pink-200/50 transition-all duration-500 hover:rotate-12 hover:scale-110">
              <SparklesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-sm" />
            </div>
            <span className="font-display font-bold text-lg sm:text-2xl tracking-tight text-slate-800 hidden sm:inline">
              Animate<span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Image</span>
            </span>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end">
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 bg-white/50 p-1 sm:p-1.5 rounded-full border border-white/50 shadow-inner">
              <button
                onClick={() => switchMode('animate')}
                className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 hover:scale-105 active:scale-95 ${mode === 'animate'
                  ? 'bg-gradient-to-r from-cute-pink to-cute-purple text-white shadow-md shadow-pink-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                  }`}
              >
                <span className="flex items-center gap-1 sm:gap-2">
                  <VideoIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Animate</span>
                </span>
              </button>
              <button
                onClick={() => switchMode('edit')}
                className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 hover:scale-105 active:scale-95 ${mode === 'edit'
                  ? 'bg-gradient-to-r from-cute-pink to-cute-purple text-white shadow-md shadow-pink-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                  }`}
              >
                <span className="flex items-center gap-1 sm:gap-2">
                  <WandIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Edit</span>
                </span>
              </button>
            </div>

            {/* Settings Button */}
            <button
              onClick={openSettings}
              className="p-2 sm:p-2.5 text-slate-400 hover:text-cute-purple hover:bg-white rounded-full transition-all duration-300 shadow-sm hover:shadow-md hover:rotate-45 hover:scale-110 shrink-0"
              title="API Key Settings"
            >
              <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Auth: Google Sign-In or User Profile */}
            <div className="shrink-0">
              {authLoading ? (
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/50 animate-pulse" />
              ) : user ? (
                <UserProfileMenu user={user} onSignOut={() => setUser(null)} />
              ) : (
                <div className="p-[2px] rounded-full bg-gradient-to-r from-cute-pink to-cute-purple shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                  <div className="bg-white rounded-full overflow-hidden">
                    <CustomGoogleSignInButton width="auto" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="w-[95%] lg:w-[90%] mx-auto py-4 lg:py-5 animate-in fade-in slide-in-from-bottom-8 duration-700 flex-1 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 flex-1">

          {/* LEFT COLUMN: Inputs */}
          <div className="lg:col-span-5 flex flex-col gap-4 lg:gap-5">

            {/* Image Uploader */}
            <div className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-2xl lg:rounded-3xl p-2 shadow-xl shadow-pink-100/50 transition-all duration-500 hover:shadow-2xl hover:shadow-pink-200/50 hover:scale-[1.01] flex-1 flex flex-col min-h-0">
              <div
                className={`relative group flex-1 min-h-[180px] rounded-xl lg:rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center overflow-hidden
                  ${selectedImage
                    ? 'border-transparent bg-white'
                    : 'border-pink-200 bg-pink-50/30 hover:border-pink-300 hover:bg-pink-50/50 cursor-pointer'
                  }`}
                onClick={() => !selectedImage && fileInputRef.current?.click()}
              >
                {selectedImage ? (
                  <>
                    <img
                      src={`data:${mimeType};base64,${selectedImage}`}
                      alt="Selected"
                      className="absolute inset-0 w-full h-full object-contain rounded-xl"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); clearAll(); }}
                      className="absolute top-2 right-2 p-2 bg-white/80 text-red-400 hover:text-red-500 rounded-xl backdrop-blur-sm border border-white/50 shadow-sm transition-colors hover:shadow-md z-10"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-white shadow-lg shadow-pink-100 flex items-center justify-center mb-3 lg:mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                      <UploadIcon className="w-7 h-7 lg:w-8 lg:h-8 text-pink-300 group-hover:text-pink-400 transition-colors" />
                    </div>
                    <p className="text-slate-600 font-bold text-base lg:text-lg">Click to upload image</p>
                    <p className="text-slate-400 text-sm mt-1">JPG, PNG supported</p>
                  </>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl lg:rounded-3xl p-4 lg:p-5 space-y-4 lg:space-y-5 shadow-xl shadow-purple-100/50">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 lg:mb-3 ml-1">
                  {mode === 'animate' ? 'Animation Description' : 'Edit Instructions'}
                </label>

                {mode === 'animate' && isAutoPrompt ? (
                  <div className="relative animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-full bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-xl lg:rounded-2xl p-3 lg:p-4 text-slate-600 h-24 lg:h-28 overflow-y-auto shadow-inner">
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-transparent">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/80 text-purple-500 text-xs font-bold border border-purple-100 shadow-sm">
                          <SparklesIcon className="w-3 h-3" /> AI Generated
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed opacity-90 font-medium">{prompt}</p>
                    </div>
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={() => setIsAutoPrompt(false)}
                        className="px-3 py-1 bg-white/80 hover:bg-white text-slate-500 hover:text-purple-500 text-xs font-bold rounded-lg border border-white shadow-sm transition-all backdrop-blur-sm"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={mode === 'animate'
                      ? "Leave empty for AI auto-description, or describe the movement..."
                      : "E.g., Add a cyberpunk neon glow, remove background..."
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl lg:rounded-2xl p-3 lg:p-4 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-300 transition-all duration-300 focus:scale-[1.01] resize-none h-24 lg:h-28 shadow-sm"
                  />
                )}
              </div>

              {mode === 'animate' && (
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 lg:mb-3 ml-1">
                    Output Aspect Ratio
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setAspectRatio('16:9')}
                      className={`py-2.5 lg:py-3 px-4 rounded-xl border text-sm font-bold transition-all duration-300 hover:scale-105 active:scale-95 ${aspectRatio === '16:9'
                        ? 'bg-pink-50 border-pink-200 text-pink-500 shadow-inner'
                        : 'bg-white border-slate-100 text-slate-400 hover:border-pink-200 hover:text-pink-400'
                        }`}
                    >
                      Landscape (16:9)
                    </button>
                    <button
                      onClick={() => setAspectRatio('9:16')}
                      className={`py-2.5 lg:py-3 px-4 rounded-xl border text-sm font-bold transition-all duration-300 hover:scale-105 active:scale-95 ${aspectRatio === '9:16'
                        ? 'bg-pink-50 border-pink-200 text-pink-500 shadow-inner'
                        : 'bg-white border-slate-100 text-slate-400 hover:border-pink-200 hover:text-pink-400'
                        }`}
                    >
                      Portrait (9:16)
                    </button>
                  </div>
                </div>
              )}

              {processing.error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                  <AlertCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 font-medium">{processing.error}</p>
                </div>
              )}

              <button
                onClick={handleGenerateClick}
                disabled={!selectedImage || processing.isLoading}
                className={`w-full py-3.5 lg:py-4 rounded-xl lg:rounded-2xl font-bold text-base lg:text-lg shadow-lg flex items-center justify-center gap-2 transition-all duration-300
                  ${!selectedImage || processing.isLoading
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cute-pink to-cute-purple text-white hover:shadow-pink-300/50 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                  }`}
              >
                {processing.isLoading ? 'Processing...' : (
                  <>
                    <SparklesIcon className="w-5 h-5" />
                    {mode === 'animate' ? 'Generate Video' : 'Generate Edit'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Results */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="flex-1 bg-white/60 backdrop-blur-md border border-white/60 rounded-2xl lg:rounded-3xl p-2 overflow-hidden flex flex-col shadow-xl shadow-blue-100/50">
              <div className="flex-1 bg-white/50 rounded-xl lg:rounded-2xl flex items-center justify-center relative overflow-hidden border-2 border-dashed border-white/50">

                {/* Empty State */}
                {!processing.isLoading && !resultImage && !resultVideo && (
                  <div className="text-center p-6 lg:p-8 opacity-60">
                    <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-100">
                      {mode === 'animate' ? <VideoIcon className="w-8 h-8 lg:w-10 lg:h-10 text-purple-300" /> : <WandIcon className="w-8 h-8 lg:w-10 lg:h-10 text-purple-300" />}
                    </div>
                    <p className="text-lg lg:text-xl font-bold text-slate-600">Ready to create magic</p>
                    <p className="text-slate-400 text-sm lg:text-base">Upload an image and click Generate</p>
                  </div>
                )}

                {/* Loading State */}
                {processing.isLoading && (
                  <LoadingSpinner
                    message={processing.statusMessage}
                    subMessage={mode === 'animate' ? "Crafting your frames..." : "Painting pixels..."}
                  />
                )}

                {/* Result: Image */}
                {!processing.isLoading && resultImage && (
                  <div className="w-full h-full flex flex-col animate-in zoom-in-95 duration-300">
                    <div className="flex-1 p-4 flex items-center justify-center">
                      <img src={resultImage} alt="Edited Result" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl shadow-purple-200/50" />
                    </div>
                    <div className="p-4 bg-white/80 backdrop-blur-md border-t border-white/50 flex justify-between items-center">
                      <span className="text-sm text-slate-500 font-bold">Enhanced Image Result</span>
                      <a
                        href={resultImage}
                        download="edited-image.png"
                        className="px-4 py-2 bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-600 rounded-xl text-sm font-bold border border-slate-100 shadow-sm transition-all duration-300 hover:scale-105 active:scale-95"
                      >
                        Download Image
                      </a>
                    </div>
                  </div>
                )}

                {/* Result: Video */}
                {!processing.isLoading && resultVideo && (
                  <div className="w-full h-full flex flex-col animate-in zoom-in-95 duration-300">
                    <div className="flex-1 bg-black/5 flex items-center justify-center rounded-t-2xl overflow-hidden">
                      <video
                        src={resultVideo}
                        controls
                        loop
                        autoPlay
                        className="max-w-full max-h-full shadow-2xl"
                        style={{ aspectRatio: aspectRatio.replace(':', '/') }}
                      />
                    </div>
                    <div className="p-4 bg-white/80 backdrop-blur-md border-t border-white/50 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-600 font-bold">Video Generation Result</span>
                        {/* <span className="text-xs text-slate-500">Loop enabled</span> */}
                      </div>
                      <a
                        href={resultVideo}
                        // Note: Direct download might be blocked by CORS depending on browser/security,
                        // but opening in new tab usually allows "Save Video As"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-600 rounded-xl text-sm font-bold border border-slate-100 shadow-sm transition-all duration-300 hover:scale-105 active:scale-95"
                      >
                        Download Video
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSubmit={handleApiKeySubmit}
        errorMessage={modalError}
        user={user}
      />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
};

export default App;