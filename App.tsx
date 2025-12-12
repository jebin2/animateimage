import React, { useState, useRef, useEffect } from 'react';
import { AppMode, ProcessingState, AspectRatio } from './types';
import { editImage, generateVideo, generateAnimationPrompt, GeminiOptions } from './services/geminiService';
import { initUsage, recordUsage } from './services/usageService';
import { UploadIcon, VideoIcon, WandIcon, TrashIcon, AlertCircleIcon, SparklesIcon, SettingsIcon, GoogleIcon } from './components/Icons';
import LoadingSpinner from './components/LoadingSpinner';
import ApiKeyModal from './components/ApiKeyModal';
import UserProfileMenu from './components/UserProfileMenu';
import { GoogleUser, initializeAuth, initGoogleAuth, renderGoogleButton, onAuthStateChange, isAuthenticated } from './services/googleAuthService';

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
  const googleButtonRef = useRef<HTMLDivElement>(null);

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
  useEffect(() => {
    if (!authLoading && !user && googleButtonRef.current) {
      // Small delay to ensure Google SDK is initialized
      const timer = setTimeout(() => {
        if (googleButtonRef.current) {
          try {
            renderGoogleButton(googleButtonRef.current, {
              theme: 'filled_black',
              size: 'medium',
              shape: 'pill'
            });
          } catch (e) {
            console.error('Failed to render Google button:', e);
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [authLoading, user]);

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
      } else {
        // Animation Logic
        let finalPrompt = prompt;

        // If prompt is empty, generate it using Gemini Vision
        if (!finalPrompt.trim()) {
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

        setModalError(friendlyMsg);
        setShowApiKeyModal(true);
        setPendingAutoGenerate(true);
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
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 relative">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Animate<span className="text-indigo-400">Image</span></span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
              <button
                onClick={() => switchMode('animate')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'animate'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
              >
                <span className="flex items-center gap-2"><VideoIcon className="w-4 h-4" /> Animate</span>
              </button>
              <button
                onClick={() => switchMode('edit')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'edit'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
              >
                <span className="flex items-center gap-2"><WandIcon className="w-4 h-4" /> Edit Image</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Settings Button */}
              <button
                onClick={openSettings}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                title="API Key Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>

              {/* Auth: Google Sign-In or User Profile */}
              {authLoading ? (
                <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse" />
              ) : user ? (
                <UserProfileMenu user={user} onSignOut={() => setUser(null)} />
              ) : (
                <div ref={googleButtonRef} className="min-w-[120px]">
                  {/* Google button will be rendered here by useEffect */}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* LEFT COLUMN: Inputs */}
          <div className="lg:col-span-5 space-y-6">

            {/* Image Uploader */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-1 overflow-hidden">
              <div
                className={`relative group aspect-[4/3] rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center
                  ${selectedImage
                    ? 'border-transparent bg-slate-950'
                    : 'border-slate-700 bg-slate-800/30 hover:border-indigo-500/50 hover:bg-slate-800/50 cursor-pointer'
                  }`}
                onClick={() => !selectedImage && fileInputRef.current?.click()}
              >
                {selectedImage ? (
                  <>
                    <img
                      src={`data:${mimeType};base64,${selectedImage}`}
                      alt="Selected"
                      className="w-full h-full object-contain rounded-xl"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); clearAll(); }}
                      className="absolute top-2 right-2 p-2 bg-slate-900/80 text-red-400 hover:text-red-300 rounded-lg backdrop-blur-sm border border-slate-700 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <UploadIcon className="w-8 h-8 text-slate-400 group-hover:text-indigo-400" />
                    </div>
                    <p className="text-slate-300 font-medium">Click to upload image</p>
                    <p className="text-slate-500 text-sm mt-1">JPG, PNG supported</p>
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {mode === 'animate' ? 'Animation Description' : 'Edit Instructions'}
                </label>

                {mode === 'animate' && isAutoPrompt ? (
                  <div className="relative animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-full bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 text-indigo-100 h-32 overflow-y-auto shadow-inner">
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-transparent">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
                          <SparklesIcon className="w-3 h-3" /> AI Generated
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed opacity-90">{prompt}</p>
                    </div>
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={() => setIsAutoPrompt(false)}
                        className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700 transition-all backdrop-blur-sm"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none h-32"
                  />
                )}
              </div>

              {mode === 'animate' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Output Aspect Ratio
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setAspectRatio('16:9')}
                      className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${aspectRatio === '16:9'
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                    >
                      Landscape (16:9)
                    </button>
                    <button
                      onClick={() => setAspectRatio('9:16')}
                      className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${aspectRatio === '9:16'
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                    >
                      Portrait (9:16)
                    </button>
                  </div>
                </div>
              )}

              {processing.error && (
                <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl flex items-start gap-3">
                  <AlertCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{processing.error}</p>
                </div>
              )}

              <button
                onClick={handleGenerateClick}
                disabled={!selectedImage || processing.isLoading}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all
                  ${!selectedImage || processing.isLoading
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/25 active:scale-[0.99]'
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
          <div className="lg:col-span-7">
            <div className="h-full bg-slate-900 border border-slate-800 rounded-2xl p-1 overflow-hidden min-h-[500px] flex flex-col">
              <div className="flex-1 bg-slate-950 rounded-xl flex items-center justify-center relative overflow-hidden">

                {/* Empty State */}
                {!processing.isLoading && !resultImage && !resultVideo && (
                  <div className="text-center p-8 opacity-40">
                    <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-800">
                      {mode === 'animate' ? <VideoIcon className="w-10 h-10" /> : <WandIcon className="w-10 h-10" />}
                    </div>
                    <p className="text-lg font-medium">Ready to create</p>
                    <p className="text-sm">Upload an image and click Generate</p>
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
                      <img src={resultImage} alt="Edited Result" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                    </div>
                    <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
                      <span className="text-sm text-slate-400">Enhanced Image Result</span>
                      <a
                        href={resultImage}
                        download="edited-image.png"
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        Download Image
                      </a>
                    </div>
                  </div>
                )}

                {/* Result: Video */}
                {!processing.isLoading && resultVideo && (
                  <div className="w-full h-full flex flex-col animate-in zoom-in-95 duration-300">
                    <div className="flex-1 bg-black flex items-center justify-center">
                      <video
                        src={resultVideo}
                        controls
                        loop
                        autoPlay
                        className="max-w-full max-h-full"
                        style={{ aspectRatio: aspectRatio.replace(':', '/') }}
                      />
                    </div>
                    <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-300 font-medium">Video Generation Result</span>
                        {/* <span className="text-xs text-slate-500">Loop enabled</span> */}
                      </div>
                      <a
                        href={resultVideo}
                        // Note: Direct download might be blocked by CORS depending on browser/security,
                        // but opening in new tab usually allows "Save Video As"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
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
    </div>
  );
};

export default App;