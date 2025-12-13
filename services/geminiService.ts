// Dual-Mode Gemini AI Service
// Client-side mode: Uses @google/genai directly (API key provided)
// Server-side mode: Uses authenticated server API with job polling (credits mode)
// STRICT RULE: API key NEVER sent to server

import { GoogleGenAI } from "@google/genai";
import { getAccessToken, updateUserCredits } from "./googleAuthService";

// ==================== Types ====================

export type AspectRatio = '16:9' | '9:16';

export interface GeminiServiceConfig {
  apiBaseUrl: string;
  defaultAnimationPrompt: string;
}

export interface GeminiOptions {
  apiKey?: string;           // If provided → client-side mode, NEVER hits server
  useCredits?: boolean;      // If true → server-side mode with JWT
  onStatus?: (message: string) => void;  // Progress callback
  aspectRatio?: AspectRatio;
  resolution?: '720p' | '1080p';
  numberOfVideos?: number;
}

interface JobResponse {
  success: boolean;
  job_id: string;
  status: string;
  position?: number;
  credits_remaining?: number;
}

interface JobStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  position?: number;
  started_at?: string;
  output?: {
    text?: string;
    image?: string;
    filename?: string;
  };
  download_url?: string;
  error?: string;
  credits_remaining?: number;
  prompt?: string;
}

// ==================== Configuration ====================

let CONFIG: GeminiServiceConfig = {
  apiBaseUrl: '',
  defaultAnimationPrompt: ''
};

export function configureGeminiService(config: Partial<GeminiServiceConfig>) {
  if (config.apiBaseUrl !== undefined) CONFIG.apiBaseUrl = config.apiBaseUrl;
  if (config.defaultAnimationPrompt !== undefined) CONFIG.defaultAnimationPrompt = config.defaultAnimationPrompt;
}

// Model names for client-side mode
const MODELS = {
  textGeneration: 'gemini-2.5-flash',
  imageEdit: 'gemini-2.5-flash-image',
  videoGeneration: 'veo-3.1-generate-preview'
} as const;

// Poll intervals by job type (milliseconds)
const POLL_INTERVALS = {
  fast: 3000,      // text, analyze, animation_prompt
  medium: 10000,   // edit_image
  slow: 15000      // video
};

// ==================== Client-Side Helpers ====================

function getAIClient(apiKey: string): GoogleGenAI {
  if (!apiKey) throw new Error("API Key is missing.");
  return new GoogleGenAI({ apiKey });
}

function handleClientError(error: any, context: string): never {
  const msg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
  if (msg.includes("404") || msg.includes("NOT_FOUND") || msg.includes("Requested entity was not found")) {
    throw new Error(`Model not found (${context}). Ensure your API key has access to this model.`);
  }
  throw error;
}

// ==================== Server-Side Helpers ====================

async function serverFetch(endpoint: string, body: object): Promise<any> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated. Please sign in.");

  const response = await fetch(`${CONFIG.apiBaseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("Session expired. Please sign in again.");
    if (response.status === 402) throw new Error("Insufficient credits.");
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `Server error: ${response.status}`);
  }

  const data = await response.json();

  // Update credits from response if available (after job creation, credits are reserved)
  if (data.credits_remaining !== undefined) {
    updateUserCredits(data.credits_remaining).catch(console.error);
  }

  return data;
}

async function pollJobStatus(
  jobId: string,
  interval: number,
  onStatus?: (msg: string) => void
): Promise<JobStatus> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated.");

  while (true) {
    const response = await fetch(`${CONFIG.apiBaseUrl}/gemini/job/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Session expired. Please sign in again.");
      if (response.status === 404) throw new Error("Job not found.");
      throw new Error(`Failed to check job status: ${response.status}`);
    }

    const status: JobStatus = await response.json();

    // Update credits from response if available
    if (status.credits_remaining !== undefined) {
      updateUserCredits(status.credits_remaining).catch(console.error);
    }

    if (status.status === 'queued') {
      onStatus?.(`Queued (position: ${status.position || '?'})...`);
    } else if (status.status === 'processing') {
      onStatus?.('Processing...');
    } else if (status.status === 'completed') {
      onStatus?.('Completed!');
      return status;
    } else if (status.status === 'failed') {
      throw new Error(status.error || 'Job failed');
    } else if (status.status === 'cancelled') {
      throw new Error('Job was cancelled');
    }

    await new Promise(r => setTimeout(r, interval));
  }
}

async function downloadServerVideo(jobId: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated.");

  const response = await fetch(`${CONFIG.apiBaseUrl}/gemini/download/${jobId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) throw new Error("Failed to download video");

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// ==================== Mode Detection ====================

function isClientMode(options: GeminiOptions): boolean {
  // API key takes priority - if provided, ALWAYS use client mode
  return !!options.apiKey;
}

// ==================== Public API ====================

/**
 * Generate animation prompt from image
 */
export async function generateAnimationPrompt(
  base64Image: string,
  mimeType: string,
  options: GeminiOptions = {}
): Promise<string> {
  if (isClientMode(options)) {
    // CLIENT MODE - Direct Gemini API
    options.onStatus?.('Analyzing image...');
    try {
      const ai = getAIClient(options.apiKey!);
      const response = await ai.models.generateContent({
        model: MODELS.textGeneration,
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType } },
            { text: CONFIG.defaultAnimationPrompt }
          ]
        }
      });
      options.onStatus?.('Done!');
      return response.text || "Cinematic subtle movement";
    } catch (error) {
      return handleClientError(error, MODELS.textGeneration);
    }
  } else {
    // SERVER MODE - Job queue with polling
    options.onStatus?.('Submitting to server...');
    const job: JobResponse = await serverFetch('/gemini/generate-animation-prompt', {
      base64_image: base64Image,
      mime_type: mimeType
    });

    const result = await pollJobStatus(job.job_id, POLL_INTERVALS.fast, options.onStatus);
    return result.output?.text || "Cinematic subtle movement";
  }
}

/**
 * Edit an image using AI
 */
export async function editImage(
  base64Image: string,
  mimeType: string,
  prompt: string,
  options: GeminiOptions = {}
): Promise<string> {
  if (isClientMode(options)) {
    // CLIENT MODE - Direct Gemini API
    options.onStatus?.('Editing image...');
    try {
      const ai = getAIClient(options.apiKey!);
      const response = await ai.models.generateContent({
        model: MODELS.imageEdit,
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType } },
            { text: prompt || "Enhance this image" }
          ]
        }
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error("No candidates returned from Gemini.");
      }

      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          options.onStatus?.('Done!');
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data found in the response.");
    } catch (error) {
      return handleClientError(error, MODELS.imageEdit);
    }
  } else {
    // SERVER MODE - Job queue with polling
    options.onStatus?.('Submitting to server...');
    const job: JobResponse = await serverFetch('/gemini/edit-image', {
      base64_image: base64Image,
      mime_type: mimeType,
      prompt
    });

    const result = await pollJobStatus(job.job_id, POLL_INTERVALS.medium, options.onStatus);
    if (result.output?.image) {
      return result.output.image;
    }
    throw new Error("No image returned from server");
  }
}

/**
 * Generate a video from image
 */
export async function generateVideo(
  base64Image: string,
  mimeType: string,
  prompt: string,
  options: GeminiOptions = {}
): Promise<{ url: string; jobId?: string; prompt?: string }> {
  const aspectRatio = options.aspectRatio || '16:9';
  const resolution = options.resolution || '720p';
  const numberOfVideos = options.numberOfVideos || 1;

  if (isClientMode(options)) {
    // CLIENT MODE - Direct Gemini API with polling
    options.onStatus?.('Starting video generation...');
    const ai = getAIClient(options.apiKey!);

    let operation;
    try {
      operation = await ai.models.generateVideos({
        model: MODELS.videoGeneration,
        prompt,
        image: { imageBytes: base64Image, mimeType },
        config: { numberOfVideos, resolution, aspectRatio }
      });
    } catch (error) {
      return handleClientError(error, MODELS.videoGeneration);
    }

    // Client-side polling
    while (!operation.done) {
      options.onStatus?.('Generating video (this may take 1-2 minutes)...');
      await new Promise(r => setTimeout(r, 10000));
      try {
        operation = await ai.operations.getVideosOperation({ operation });
      } catch (error: any) {
        const msg = error.message || '';
        if (msg.includes("404") || msg.includes("NOT_FOUND")) {
          throw new Error("Video generation operation lost. Please try again.");
        }
        throw error;
      }
    }

    if (operation.error) {
      throw new Error(`Video generation failed: ${operation.error.message || 'Unknown error'}`);
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error("No video URI returned. May be due to safety filters.");
    }

    options.onStatus?.('Done!');
    return { url: `${videoUri}&key=${options.apiKey}` };
  } else {
    // SERVER MODE - Job queue with polling
    options.onStatus?.('Submitting to server...');
    const job: JobResponse = await serverFetch('/gemini/generate-video', {
      base64_image: base64Image,
      mime_type: mimeType,
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      number_of_videos: numberOfVideos
    });

    const result = await pollJobStatus(job.job_id, POLL_INTERVALS.slow, options.onStatus);

    // Download video and return blob URL
    options.onStatus?.('Downloading video...');
    const url = await downloadServerVideo(job.job_id);
    return { url, jobId: job.job_id, prompt: result.prompt };
  }
}

/**
 * Generate text response
 */
export async function generateText(
  prompt: string,
  options: GeminiOptions = {}
): Promise<string> {
  if (isClientMode(options)) {
    // CLIENT MODE
    options.onStatus?.('Generating...');
    try {
      const ai = getAIClient(options.apiKey!);
      const response = await ai.models.generateContent({
        model: MODELS.textGeneration,
        contents: { parts: [{ text: prompt }] }
      });
      options.onStatus?.('Done!');
      return response.text || "";
    } catch (error) {
      return handleClientError(error, MODELS.textGeneration);
    }
  } else {
    // SERVER MODE
    options.onStatus?.('Submitting to server...');
    const job: JobResponse = await serverFetch('/gemini/generate-text', { prompt });
    const result = await pollJobStatus(job.job_id, POLL_INTERVALS.fast, options.onStatus);
    return result.output?.text || "";
  }
}

/**
 * Analyze image with custom prompt
 */
export async function analyzeImage(
  base64Image: string,
  mimeType: string,
  prompt: string,
  options: GeminiOptions = {}
): Promise<string> {
  if (isClientMode(options)) {
    // CLIENT MODE
    options.onStatus?.('Analyzing...');
    try {
      const ai = getAIClient(options.apiKey!);
      const response = await ai.models.generateContent({
        model: MODELS.textGeneration,
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType } },
            { text: prompt }
          ]
        }
      });
      options.onStatus?.('Done!');
      return response.text || "";
    } catch (error) {
      return handleClientError(error, MODELS.textGeneration);
    }
  } else {
    // SERVER MODE
    options.onStatus?.('Submitting to server...');
    const job: JobResponse = await serverFetch('/gemini/analyze-image', {
      base64_image: base64Image,
      mime_type: mimeType,
      prompt
    });
    const result = await pollJobStatus(job.job_id, POLL_INTERVALS.fast, options.onStatus);
    return result.output?.text || "";
  }
}

// Export for reference
export { MODELS };