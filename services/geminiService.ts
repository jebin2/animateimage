import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";
import { ANIMATION_PROMPT } from "../prompts/animation";

/**
 * Helper to get a fresh AI instance with the provided key.
 */
const getAIClient = (apiKey: string) => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

const handleApiError = (error: any, context: string) => {
  // Handle gRPC error arrays like [5, "Requested entity was not found."]
  const msg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));

  if (msg.includes("404") || msg.includes("NOT_FOUND") || msg.includes("Requested entity was not found") || msg.includes("[5,")) {
    throw new Error(`Model not found (${context}). Ensure your API key project has access to this model. Veo requires a paid account.`);
  }
  throw error;
};

/**
 * Analyzes the image to generate a suitable animation prompt.
 */
export const generateAnimationPrompt = async (
  base64Image: string,
  mimeType: string,
  apiKey: string
): Promise<string> => {
  try {
    const ai = getAIClient(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: ANIMATION_PROMPT }
        ]
      }
    });
    return response.text || "Cinematic subtle movement";
  } catch (error) {
    return handleApiError(error, 'gemini-2.5-flash');
  }
};

/**
 * Edit an image using Gemini 2.5 Flash Image.
 */
export const editImage = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  apiKey: string
): Promise<string> => {
  try {
    const ai = getAIClient(apiKey);

    // Construct parts: Image first, then text prompt
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
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts,
      },
    });

    // Extract result image
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
    return handleApiError(error, 'gemini-2.5-flash-image');
  }
};

/**
 * Generate a video using Veo (gemini-3-pro based video generation).
 */
export const generateVideo = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  aspectRatio: AspectRatio = '16:9',
  apiKey: string
): Promise<string> => {
  const ai = getAIClient(apiKey);

  let operation;
  try {
    // Initial request to start generation
    operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt, // Prompt is required/highly recommended
      image: {
        imageBytes: base64Image,
        mimeType: mimeType,
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p', // Can be 720p or 1080p
        aspectRatio: aspectRatio,
      }
    });
  } catch (error) {
    return handleApiError(error, 'veo-3.1-fast-generate-preview');
  }

  // Polling loop
  while (!operation.done) {
    // Wait 10 seconds before next poll (recommended for Video)
    await new Promise(resolve => setTimeout(resolve, 10000));
    try {
      operation = await ai.operations.getVideosOperation({ operation: operation });
      console.log("Polling Veo operation...", operation);
    } catch (error: any) {
      const msg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
      // If operation lookup fails with 404, it might be expired or invalid name
      if (msg.includes("404") || msg.includes("NOT_FOUND") || msg.includes("Requested entity was not found") || msg.includes("[5,")) {
        throw new Error("Video generation operation lost (404). Please try again.");
      }
      throw error;
    }
  }

  // Check for explicit error in operation
  if (operation.error) {
    throw new Error(`Video generation failed: ${operation.error.message || 'Unknown error'}`);
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) {
    console.error("Operation completed but no video URI found.", operation);
    throw new Error("No video URI returned after operation completion. This may be due to safety filters or service load.");
  }

  // Fetch the actual video bytes using the URI + API Key
  const downloadUrl = `${videoUri}&key=${apiKey}`;

  return downloadUrl;
};