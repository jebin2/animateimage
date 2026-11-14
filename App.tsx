import React, { useState, useRef, useEffect } from 'react';
import { AppMode, ProcessingState, AspectRatio } from './types';
import { editImage, generateVideo, generateAnimationPrompt, checkKey, Capabilities, VIDEO_SECONDS, VIDEO_USD_PER_SECOND } from './services/geminiService';
import { loadKey, saveKey, forgetKey } from './services/keyStore';
import { UploadIcon, VideoIcon, WandIcon, TrashIcon, SparklesIcon, SettingsIcon, HeartIcon, DownloadIcon, RefreshIcon } from './components/Icons';
import LoadingSpinner from './components/LoadingSpinner';
import ApiKeyModal from './components/ApiKeyModal';
import ToastContainer from './components/ToastContainer';
import { showError, showWarning } from './services/toastService';

// Gemini takes images inline in the request, which is capped at 20 MB.
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [rememberKey, setRememberKey] = useState<boolean>(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [pendingAutoGenerate, setPendingAutoGenerate] = useState<boolean>(false);

  const [mode, setMode] = useState<AppMode>('animate');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [fileName, setFileName] = useState<string>('image');
  const [prompt, setPrompt] = useState<string>('');
  const [isAutoPrompt, setIsAutoPrompt] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [loop, setLoop] = useState<boolean>(true);
  const [seconds, setSeconds] = useState<number>(6);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [dragging, setDragging] = useState(false);

  const [processing, setProcessing] = useState<ProcessingState>({ isLoading: false, statusMessage: '' });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<{ model: string; looped: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const { key, remembered } = loadKey();
    setApiKey(key);
    setRememberKey(remembered || !key);
    // What the saved key can do (no cost: nothing is generated).
    if (key) checkKey(key).then(setCaps).catch(() => setCaps(null));
  }, []);

  // Seconds counter while waiting (video takes minutes).
  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  // Free the previous video's memory when it's replaced.
  useEffect(() => () => { if (resultVideo) URL.revokeObjectURL(resultVideo); }, [resultVideo]);

  const resetResults = () => {
    setResultImage(null);
    setResultVideo(null);
    setVideoInfo(null);
  };

  const executeGeneration = async (key: string) => {
    if (!selectedImage) return;
    resetResults();
    setProcessing({ isLoading: true, statusMessage: 'Starting…' });
    setElapsed(0);
    setStartedAt(Date.now());
    const onStatus = (message: string) => setProcessing(prev => ({ ...prev, statusMessage: message }));

    try {
      if (mode === 'edit') {
        setResultImage(await editImage(selectedImage, mimeType, prompt, { apiKey: key, onStatus }));
      } else {
        let finalPrompt = prompt.trim();
        if (!finalPrompt) {
          try {
            finalPrompt = await generateAnimationPrompt(selectedImage, mimeType, { apiKey: key, onStatus });
            setPrompt(finalPrompt);
            setIsAutoPrompt(true);
          } catch (err) {
            console.warn('Auto description failed', err);
            finalPrompt = 'Subtle cinematic movement';
          }
        }
        const { url, model, looped } = await generateVideo(selectedImage, mimeType, finalPrompt, { apiKey: key, aspectRatio, loop, seconds, onStatus });
        setResultVideo(url);
        setVideoInfo({ model, looped });
        if (loop && !looped) showWarning(`${model} can't make seamless loops, so this clip doesn't loop perfectly.`);
      }
    } catch (error: any) {
      console.error(error);
      const message: string = error?.message || 'Something went wrong.';
      showError(message);
      if (/API key/.test(message)) setShowApiKeyModal(true);
    } finally {
      setProcessing({ isLoading: false, statusMessage: '' });
      setStartedAt(null);
    }
  };

  // The dialog stays open to show what the key can do; it closes itself when everything works.
  const handleKeySave = (key: string, remember: boolean, c: Capabilities) => {
    saveKey(key, remember);
    setApiKey(key);
    setRememberKey(remember);
    setCaps(c);
    if (pendingAutoGenerate && selectedImage && c[mode].ok) {
      setPendingAutoGenerate(false);
      setShowApiKeyModal(false);
      executeGeneration(key);
    }
  };

  const handleKeyForget = () => {
    forgetKey();
    setApiKey('');
    setRememberKey(true);
    setCaps(null);
  };

  const openSettings = () => {
    setPendingAutoGenerate(false);
    setShowApiKeyModal(true);
  };

  const loadFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError("That file isn't an image. Use a JPG, PNG or WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showError('That image is over 15 MB. Use a smaller one.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setSelectedImage(result.split(',')[1]);
      setMimeType(file.type);
      setFileName(file.name.replace(/\.[^.]+$/, '') || 'image');
      resetResults();
      if (isAutoPrompt) { setPrompt(''); setIsAutoPrompt(false); }
    };
    reader.readAsDataURL(file);
  };

  // Paste an image from the clipboard anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
      if (item) loadFile(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const handleGenerateClick = () => {
    if (!selectedImage || processing.isLoading) return;
    if (apiKey && caps && !caps[mode].ok) {
      showError(`Your key can't ${mode === 'animate' ? 'make videos' : 'edit images'}: it ${caps[mode].why}.`);
      setShowApiKeyModal(true);
    } else if (apiKey) {
      executeGeneration(apiKey);
    } else {
      setPendingAutoGenerate(true);
      setShowApiKeyModal(true);
    }
  };

  const clearAll = () => {
    setSelectedImage(null);
    setMimeType('');
    resetResults();
    setPrompt('');
    setIsAutoPrompt(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const switchMode = (newMode: AppMode) => {
    setMode(newMode);
    if (isAutoPrompt) setPrompt('');
    setIsAutoPrompt(false);
  };

  const elapsedText = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  const modeButton = (m: AppMode, Icon: React.FC<{ className?: string }>, label: string) => (
    <button
      onClick={() => switchMode(m)}
      className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 hover:scale-105 active:scale-95 ${mode === m
        ? 'bg-gradient-to-r from-cute-pink to-cute-purple text-white shadow-md shadow-pink-200'
        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
        }`}
    >
      <span className="flex items-center gap-1 sm:gap-2">
        <Icon className="w-4 h-4" />
        <span className="hidden sm:inline">{label}</span>
      </span>
    </button>
  );

  const ratioButton = (r: AspectRatio, label: string) => (
    <button
      onClick={() => setAspectRatio(r)}
      className={`py-2.5 lg:py-3 px-4 rounded-xl border text-sm font-bold transition-all duration-300 hover:scale-105 active:scale-95 ${aspectRatio === r
        ? 'bg-pink-50 border-pink-200 text-pink-600 shadow-inner'
        : 'bg-white border-slate-100 text-slate-600 hover:border-pink-200 hover:text-pink-500'
        }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-transparent text-slate-700 font-sans selection:bg-cute-pink selection:text-pink-900 relative flex flex-col">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/60 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="w-[95%] lg:w-[90%] mx-auto py-2 sm:py-0 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-tr from-cute-pink to-cute-purple rounded-xl sm:rounded-2xl rotate-3 flex items-center justify-center shadow-lg shadow-pink-200/50 transition-all duration-500 hover:rotate-12 hover:scale-110">
              <SparklesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-sm" />
            </div>
            <span className="font-display font-bold text-lg sm:text-2xl tracking-tight text-slate-800 hidden sm:inline">
              Animate<span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Image</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end">
            <div className="flex items-center gap-1 bg-white/50 p-1 sm:p-1.5 rounded-full border border-white/50 shadow-inner">
              {modeButton('animate', VideoIcon, 'Animate')}
              {modeButton('edit', WandIcon, 'Edit')}
            </div>

            <a
              href="https://github.com/sponsors/jebin2?frequency=one-time&sponsor=jebin2"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 sm:p-2.5 text-pink-400 hover:text-pink-500 hover:bg-pink-50 rounded-full transition-all duration-300 shadow-sm hover:shadow-md hover:scale-110 shrink-0 group"
              title="Sponsor on GitHub"
            >
              <HeartIcon className="w-4 h-4 sm:w-5 sm:h-5 group-hover:animate-pulse" />
            </a>

            <button
              onClick={openSettings}
              className={`relative p-2 sm:p-2.5 hover:text-cute-purple hover:bg-white rounded-full transition-all duration-300 shadow-sm hover:shadow-md hover:rotate-45 hover:scale-110 shrink-0 ${apiKey ? 'text-slate-400' : 'text-purple-500 bg-white'}`}
              title={apiKey ? 'API key' : 'Add your Gemini API key'}
            >
              <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              {!apiKey && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-pink-400" />}
            </button>
          </div>
        </div>
      </header>

      <main className="w-[95%] lg:w-[90%] mx-auto py-4 lg:py-5 animate-in fade-in slide-in-from-bottom-8 duration-700 flex-1 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 flex-1">

          {/* LEFT COLUMN: Inputs */}
          <div className="lg:col-span-5 flex flex-col gap-4 lg:gap-5">

            {/* Image Uploader */}
            <div className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-2xl lg:rounded-3xl p-2 shadow-xl shadow-pink-100/50 transition-all duration-500 hover:shadow-2xl hover:shadow-pink-200/50 flex-1 flex flex-col min-h-0">
              <div
                className={`relative group flex-1 min-h-[180px] rounded-xl lg:rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center overflow-hidden
                  ${dragging
                    ? 'border-purple-300 bg-purple-50/60'
                    : selectedImage
                      ? 'border-transparent bg-white'
                      : 'border-pink-200 bg-pink-50/30 hover:border-pink-300 hover:bg-pink-50/50 cursor-pointer'
                  }`}
                onClick={() => !selectedImage && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files?.[0]); }}
              >
                {selectedImage ? (
                  <>
                    <img
                      src={`data:${mimeType};base64,${selectedImage}`}
                      alt="Your image"
                      className="absolute inset-0 w-full h-full object-contain rounded-xl"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); clearAll(); }}
                      className="absolute top-2 right-2 p-2 bg-white/80 text-red-400 hover:text-red-500 rounded-xl backdrop-blur-sm border border-white/50 shadow-sm transition-colors hover:shadow-md z-10"
                      title="Remove image"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-white shadow-lg shadow-pink-100 flex items-center justify-center mb-3 lg:mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                      <UploadIcon className="w-7 h-7 lg:w-8 lg:h-8 text-pink-300 group-hover:text-pink-400 transition-colors" />
                    </div>
                    <p className="text-slate-700 font-extrabold text-base lg:text-lg">Drop, paste or click to add an image</p>
                    <p className="text-slate-500 text-sm mt-1 font-medium">JPG, PNG or WebP, up to 15 MB</p>
                  </>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => loadFile(e.target.files?.[0])}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl lg:rounded-3xl p-4 lg:p-5 space-y-4 lg:space-y-5 shadow-xl shadow-purple-100/50">
              <div>
                <label className="block text-sm font-extrabold text-slate-700 mb-2 lg:mb-3 ml-1">
                  {mode === 'animate' ? 'Motion' : 'Edit instructions'}
                </label>

                {mode === 'animate' && isAutoPrompt ? (
                  <div className="relative animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-full bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-xl lg:rounded-2xl p-3 lg:p-4 text-slate-600 h-24 lg:h-28 overflow-y-auto shadow-inner">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/80 text-purple-500 text-xs font-bold border border-purple-100 shadow-sm">
                          <SparklesIcon className="w-3 h-3" /> Picked by Gemini
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed opacity-90 font-medium">{prompt}</p>
                    </div>
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={() => setIsAutoPrompt(false)}
                        className="px-3 py-1 bg-white/80 hover:bg-white text-slate-500 hover:text-purple-500 text-xs font-bold rounded-lg border border-white shadow-sm transition-all backdrop-blur-sm"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={mode === 'animate'
                      ? 'Describe the movement, or leave empty and Gemini will pick one…'
                      : 'E.g. add a neon glow, remove the background…'
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl lg:rounded-2xl p-3 lg:p-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-300 transition-all duration-300 resize-none h-24 lg:h-28 shadow-sm font-medium"
                  />
                )}
              </div>

              {mode === 'animate' && (
                <div>
                  <label className="block text-sm font-extrabold text-slate-700 mb-2 lg:mb-3 ml-1">
                    Shape
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {ratioButton('16:9', 'Landscape (16:9)')}
                    {ratioButton('9:16', 'Portrait (9:16)')}
                  </div>
                  <label className="mt-3 ml-1 flex items-start gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} className="mt-1 accent-purple-500" />
                    <span className="text-sm text-slate-600">
                      <span className="font-bold text-slate-700">Seamless loop.</span> The clip ends on your image, so it repeats without a jump.
                    </span>
                  </label>
                  <div className="mt-3 ml-1 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-slate-700 mr-1">Length</span>
                    {VIDEO_SECONDS.map(n => (
                      <button
                        key={n}
                        onClick={() => setSeconds(n)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-all ${seconds === n ? 'bg-pink-50 border-pink-200 text-pink-600' : 'bg-white border-slate-100 text-slate-600 hover:border-pink-200'}`}
                      >
                        {n} s
                      </button>
                    ))}
                    <span className="text-xs text-slate-500">≈ ${(seconds * VIDEO_USD_PER_SECOND).toFixed(2)} on your Google bill</span>
                  </div>
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
                {processing.isLoading ? `Working… ${elapsedText}` : (
                  <>
                    <SparklesIcon className="w-5 h-5" />
                    {mode === 'animate' ? 'Animate' : 'Edit image'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Results */}
          <div className="lg:col-span-7 flex flex-col min-h-[320px]">
            <div className="flex-1 bg-white/60 backdrop-blur-md border border-white/60 rounded-2xl lg:rounded-3xl p-2 overflow-hidden flex flex-col shadow-xl shadow-blue-100/50">
              <div className="flex-1 bg-white/50 rounded-xl lg:rounded-2xl flex items-center justify-center relative overflow-hidden border-2 border-dashed border-white/50">

                {!processing.isLoading && !resultImage && !resultVideo && (
                  <div className="text-center p-6 lg:p-8 opacity-80">
                    <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-100">
                      {mode === 'animate' ? <VideoIcon className="w-8 h-8 lg:w-10 lg:h-10 text-purple-400" /> : <WandIcon className="w-8 h-8 lg:w-10 lg:h-10 text-purple-400" />}
                    </div>
                    <p className="text-lg lg:text-xl font-extrabold text-slate-700">Bring a picture to life</p>
                    <p className="text-slate-500 text-sm lg:text-base font-medium max-w-sm mx-auto">
                      {mode === 'animate'
                        ? 'Add an image and press Animate. Google\'s video model makes a short clip.'
                        : 'Add an image, describe the change, and press Edit image.'}
                    </p>
                  </div>
                )}

                {processing.isLoading && (
                  <LoadingSpinner message={processing.statusMessage} subMessage={`${elapsedText} elapsed`} />
                )}

                {!processing.isLoading && resultImage && (
                  <div className="w-full h-full flex flex-col animate-in zoom-in-95 duration-300">
                    <div className="flex-1 p-4 flex items-center justify-center">
                      <img src={resultImage} alt="Edited result" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl shadow-purple-200/50" />
                    </div>
                    <div className="p-4 bg-white/80 backdrop-blur-md border-t border-white/50 flex justify-between items-center">
                      <span className="text-sm text-slate-500 font-bold">Edited image</span>
                      <a
                        href={resultImage}
                        download={`${fileName}-edited.png`}
                        className="px-4 py-2 bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-600 rounded-xl text-sm font-bold border border-slate-100 shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
                      >
                        <DownloadIcon className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                  </div>
                )}

                {!processing.isLoading && resultVideo && (
                  <div className="w-full h-full flex flex-col animate-in zoom-in-95 duration-300">
                    <div className="flex-1 bg-black/5 flex items-center justify-center rounded-t-2xl overflow-hidden">
                      <video
                        src={resultVideo}
                        controls
                        loop
                        autoPlay
                        muted
                        playsInline
                        className="max-w-full max-h-full shadow-2xl"
                        style={{ aspectRatio: aspectRatio.replace(':', '/') }}
                      />
                    </div>
                    <div className="p-4 bg-white/80 backdrop-blur-md border-t border-white/50 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-600 font-bold">{videoInfo?.looped ? 'Seamless loop' : 'Your clip'}</span>
                        {videoInfo && <span className="text-xs text-slate-400">{videoInfo.model}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleGenerateClick}
                          className="p-2 text-slate-400 hover:text-purple-500 hover:bg-purple-50 rounded-xl transition-colors"
                          title="Make another version"
                        >
                          <RefreshIcon className="w-5 h-5" />
                        </button>
                        <a
                          href={resultVideo}
                          download={`${fileName}-animated.mp4`}
                          className="px-4 py-2 rounded-xl text-sm font-bold border shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-600 border-slate-100"
                        >
                          <DownloadIcon className="w-4 h-4" />
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-[95%] lg:w-[90%] mx-auto pb-3 text-center text-xs text-slate-400">
        Runs in your browser with your own Gemini API key; your key and images go only to Google.{' '}
        <a href="https://github.com/jebin2/animateimage" target="_blank" rel="noreferrer" className="font-bold hover:text-purple-500">Source on GitHub</a>
      </footer>

      <ApiKeyModal
        isOpen={showApiKeyModal}
        initialKey={apiKey}
        initialRemember={rememberKey}
        caps={caps}
        onClose={() => { setShowApiKeyModal(false); setPendingAutoGenerate(false); }}
        onSave={handleKeySave}
        onForget={handleKeyForget}
      />

      <ToastContainer />
    </div>
  );
};

export default App;
