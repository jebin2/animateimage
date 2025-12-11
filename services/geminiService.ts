// Gemini AI Service for image and video generation
// Self-contained, modular service ready for plug and play
// Requires: @google/genai package

import { GoogleGenAI } from "@google/genai";

// Types - included inline for modularity
export type AspectRatio = '16:9' | '9:16';

export interface GeminiConfig {
  apiKey: string;
}

export interface VideoGenerationOptions {
  aspectRatio?: AspectRatio;
  resolution?: '720p' | '1080p';
  numberOfVideos?: number;
}

// Default animation prompt
const DEFAULT_ANIMATION_PROMPT = `Analyze this image and create a concise prompt for a video generation model to create a cinematic, loopable animation. Identify the most interesting moving element (e.g., flowing water, swaying trees, flickering light, clouds) and describe the motion. Output ONLY the description, under 30 words.`;

// Model names - easily configurable
const MODELS = {
  textGeneration: 'gemini-2.5-flash',
  imageEdit: 'gemini-2.5-flash-image',
  videoGeneration: 'veo-3.1-fast-generate-preview'
} as const;

/**
 * Get a fresh AI client instance with the provided key.
 */
function getAIClient(apiKey: string): GoogleGenAI {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Handle API errors with descriptive messages.
 */
function handleApiError(error: any, context: string): never {
  const msg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));

  if (msg.includes("404") || msg.includes("NOT_FOUND") || msg.includes("Requested entity was not found") || msg.includes("[5,")) {
    throw new Error(`Model not found (${context}). Ensure your API key project has access to this model. Veo requires a paid account.`);
  }
  throw error;
}

/**
 * Analyzes the image to generate a suitable animation prompt.
 */
export async function generateAnimationPrompt(
  base64Image: string,
  mimeType: string,
  apiKey: string,
  customPrompt?: string
): Promise<string> {
  try {
    const ai = getAIClient(apiKey);
    const response = await ai.models.generateContent({
      model: MODELS.textGeneration,
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: customPrompt || DEFAULT_ANIMATION_PROMPT }
        ]
      }
    });
    return response.text || "Cinematic subtle movement";
  } catch (error) {
    return handleApiError(error, MODELS.textGeneration);
  }
}

/**
 * Edit an image using Gemini image model.
 */
export async function editImage(
  base64Image: string,
  mimeType: string,
  prompt: string,
  apiKey: string
): Promise<string> {
  try {
    const ai = getAIClient(apiKey);

    const parts = [
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
      {
        text: prompt || "Enhance this image",
      },
    ];

    const response = await ai.models.generateContent({
      model: MODELS.imageEdit,
      contents: {
        parts: parts,
      },
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No candidates returned from Gemini.");
    }

    for (const part of candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image data found in the response.");
  } catch (error) {
    return handleApiError(error, MODELS.imageEdit);
  }
}

/**
 * Generate a video using Veo model.
 */
export async function generateVideo(
  base64Image: string,
  mimeType: string,
  prompt: string,
  apiKey: string,
  options: VideoGenerationOptions = {}
): Promise<string> {
  const {
    aspectRatio = '16:9',
    resolution = '720p',
    numberOfVideos = 1
  } = options;

  const ai = getAIClient(apiKey);

  let operation;
  try {
    operation = await ai.models.generateVideos({
      model: MODELS.videoGeneration,
      prompt: prompt,
      image: {
        imageBytes: base64Image,
        mimeType: mimeType,
      },
      config: {
        numberOfVideos,
        resolution,
        aspectRatio,
      }
    });
  } catch (error) {
    return handleApiError(error, MODELS.videoGeneration);
  }

  // Polling loop
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    try {
      operation = await ai.operations.getVideosOperation({ operation: operation });
      console.log("Polling Veo operation...", operation);
    } catch (error: any) {
      const msg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
      if (msg.includes("404") || msg.includes("NOT_FOUND") || msg.includes("Requested entity was not found") || msg.includes("[5,")) {
        throw new Error("Video generation operation lost (404). Please try again.");
      }
      throw error;
    }
  }

  if (operation.error) {
    throw new Error(`Video generation failed: ${operation.error.message || 'Unknown error'}`);
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) {
    console.error("Operation completed but no video URI found.", operation);
    throw new Error("No video URI returned after operation completion. This may be due to safety filters or service load.");
  }

  const downloadUrl = `${videoUri}&key=${apiKey}`;
  return downloadUrl;
}

/**
 * Simple text generation with Gemini
 */
export async function generateText(
  prompt: string,
  apiKey: string,
  model: string = MODELS.textGeneration
): Promise<string> {
  try {
    const ai = getAIClient(apiKey);
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] }
    });
    return response.text || "";
  } catch (error) {
    return handleApiError(error, model);
  }
}

/**
 * Analyze image with custom prompt
 */
export async function analyzeImage(
  base64Image: string,
  mimeType: string,
  prompt: string,
  apiKey: string
): Promise<string> {
  try {
    const ai = getAIClient(apiKey);
    const response = await ai.models.generateContent({
      model: MODELS.textGeneration,
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: prompt }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    return handleApiError(error, MODELS.textGeneration);
  }
}

// Export model names for reference
export { MODELS };