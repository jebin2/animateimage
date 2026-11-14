// Talks to Google's Gemini API straight from the browser, with the user's own
// API key. There is no server of ours in between: the key and the images go
// only to Google (generativelanguage.googleapis.com).

import { GoogleGenAI } from "@google/genai";
import { ANIMATION_PROMPT } from "../prompts/animation";
import { AspectRatio } from "../types";

export interface GeminiOptions {
  apiKey: string;
  onStatus?: (message: string) => void;
}

export interface VideoOptions extends GeminiOptions {
  aspectRatio: AspectRatio;
  loop: boolean;
}

// Google renames and retires models (especially previews), so the app asks the
// API which models this key can use and takes the first match from each list.
// Newest and best first; add new names at the top.
// The motion description is one short sentence: a Lite model writes it in a
// second or two, where full Flash thinks for ~25 s.
const PREFERRED = {
  text: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-flash-latest'],
  image: ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'],
  video: ['veo-3.1-generate-001', 'veo-3.1-generate-preview', 'veo-3.1-fast-generate-001', 'veo-3.1-fast-generate-preview', 'veo-3.0-generate-001'],
} as const;

type Kind = keyof typeof PREFERRED;
/** video is null when the key can't use Veo (its project has no billing). */
export type Models = { text: string; image: string; video: string | null };

export const NO_VEO = "This key can't use Veo, Google's video model: it only appears for projects with billing turned on. Turn on billing for the key's project in Google AI Studio, then try again. Edit works without it.";

const modelCache = new Map<string, Promise<Models>>();

function client(apiKey: string): GoogleGenAI {
  if (!apiKey) throw new Error("Add your Gemini API key in Settings first.");
  return new GoogleGenAI({ apiKey });
}

/** Model name -> what it can do (generateContent, predictLongRunning, …). */
async function listModels(ai: GoogleGenAI): Promise<Map<string, string[]>> {
  const models = new Map<string, string[]>();
  const pager = await ai.models.list({ config: { pageSize: 1000 } });
  for await (const m of pager) {
    if (m.name) models.set(m.name.replace(/^models\//, ''), m.supportedActions || []);
  }
  return models;
}

/** The models this key will use, picked from what the key can actually see. */
export function resolveModels(apiKey: string): Promise<Models> {
  let p = modelCache.get(apiKey);
  if (!p) {
    p = (async () => {
      let available: Map<string, string[]>;
      try {
        available = await listModels(client(apiKey));
      } catch (e) {
        throw friendlyError(e);
      }
      const can = (name: string, action: string) => available.get(name)?.includes(action) ?? false;
      // First preferred name the key has, else the newest-looking one of the family.
      const pick = (kind: Kind, action: string, family: RegExp): string | null =>
        PREFERRED[kind].find(n => can(n, action))
        ?? [...available.keys()].filter(n => family.test(n) && can(n, action)).sort().reverse()[0]
        ?? null;
      const text = pick('text', 'generateContent', /^gemini-[\d.]+-flash(-lite)?$/);
      const image = pick('image', 'generateContent', /^gemini-[\d.]+-flash(-lite)?-image$/);
      if (!text || !image) throw new Error("This key can't use Gemini's text or image models. Check the key in Google AI Studio.");
      return { text, image, video: pick('video', 'predictLongRunning', /^veo-/) };
    })();
    p.catch(() => modelCache.delete(apiKey));
    modelCache.set(apiKey, p);
  }
  return p;
}

/** Checks a key by listing models with it. Throws a readable error if it fails. */
export async function checkKey(apiKey: string): Promise<Models> {
  modelCache.delete(apiKey);
  return resolveModels(apiKey);
}

/** Turns API errors into something a person can act on. */
export function friendlyError(error: unknown): Error {
  const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
  if (/API key not valid|API_KEY_INVALID|UNAUTHENTICATED|401/i.test(msg)) {
    return new Error("Google rejected this API key. Check it in Settings.");
  }
  if (/billing|requires a paid|FAILED_PRECONDITION|PERMISSION_DENIED|403/i.test(msg)) {
    return new Error("This key's project can't use this model. Video (Veo) needs billing turned on for the project in Google AI Studio.");
  }
  if (/RESOURCE_EXHAUSTED|quota|429/i.test(msg)) {
    return new Error("Your key hit its quota or rate limit. Wait a minute, or check your limits in Google AI Studio.");
  }
  if (/NOT_FOUND|404|not found/i.test(msg)) {
    return new Error("Google says the model wasn't found for this key. It may have been renamed; reload the page to pick again.");
  }
  if (/SAFETY|blocked|responsible AI|RAI/i.test(msg)) {
    return new Error("Google's safety filters blocked this request. Try another image or description.");
  }
  if (/Failed to fetch|NetworkError|network/i.test(msg)) {
    return new Error("Couldn't reach Google. Check your connection and try again.");
  }
  return new Error(msg || "Something went wrong.");
}

function imagePart(base64Image: string, mimeType: string) {
  return { inlineData: { data: base64Image, mimeType } };
}

/** A short motion description for the image, used when the user leaves it empty. */
export async function generateAnimationPrompt(base64Image: string, mimeType: string, options: GeminiOptions): Promise<string> {
  options.onStatus?.('Looking at your image…');
  const models = await resolveModels(options.apiKey);
  try {
    const response = await client(options.apiKey).models.generateContent({
      model: models.text,
      contents: { parts: [imagePart(base64Image, mimeType), { text: ANIMATION_PROMPT }] },
    });
    return response.text?.trim() || "Subtle cinematic movement";
  } catch (e) {
    throw friendlyError(e);
  }
}

/** Edits the image as described; returns a data: URL. */
export async function editImage(base64Image: string, mimeType: string, prompt: string, options: GeminiOptions): Promise<string> {
  options.onStatus?.('Editing your image…');
  const models = await resolveModels(options.apiKey);
  try {
    const response = await client(options.apiKey).models.generateContent({
      model: models.image,
      contents: { parts: [imagePart(base64Image, mimeType), { text: prompt || "Enhance this image" }] },
    });
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
    const reason = response.candidates?.[0]?.finishReason || response.promptFeedback?.blockReason;
    throw new Error(reason ? `No image returned (${reason}).` : "No image returned. Try rewording the instructions.");
  } catch (e) {
    throw friendlyError(e);
  }
}

/** Fetches the finished video into memory, so it can be played and saved without the key in a URL. */
async function fetchVideo(uri: string, apiKey: string): Promise<Blob> {
  // Header first (keeps the key out of the URL); some redirects need the query form.
  const attempts: [string, RequestInit][] = [
    [uri, { headers: { 'x-goog-api-key': apiKey } }],
    [`${uri}${uri.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`, {}],
  ];
  let last: unknown;
  for (const [url, init] of attempts) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return await res.blob();
      last = new Error(`Download failed (HTTP ${res.status})`);
    } catch (e) {
      last = e;
    }
  }
  throw friendlyError(last);
}

/**
 * Animates the image with Veo. With `loop`, the image is also the last frame,
 * so the clip ends where it started and repeats without a jump.
 * Returns a blob: URL of the MP4.
 */
export async function generateVideo(
  base64Image: string,
  mimeType: string,
  prompt: string,
  options: VideoOptions,
): Promise<{ url: string; blob: Blob; model: string; looped: boolean }> {
  const { apiKey, aspectRatio, onStatus } = options;
  const models = await resolveModels(apiKey);
  if (!models.video) throw new Error(NO_VEO);
  const video = models.video;
  const ai = client(apiKey);
  const image = { imageBytes: base64Image, mimeType };

  const start = (loop: boolean) => ai.models.generateVideos({
    model: video,
    prompt,
    image,
    config: { numberOfVideos: 1, aspectRatio, ...(loop ? { lastFrame: image } : {}) },
  });

  onStatus?.('Sending to Veo…');
  let looped = options.loop;
  let operation;
  try {
    operation = await start(looped);
  } catch (e) {
    // Older Veo models don't take a last frame: still make the video.
    const msg = e instanceof Error ? e.message : String(e);
    if (looped && /last_?frame|lastFrame|not supported|INVALID_ARGUMENT/i.test(msg)) {
      looped = false;
      operation = await start(false).catch(err => { throw friendlyError(err); });
    } else {
      throw friendlyError(e);
    }
  }

  onStatus?.('Veo is animating… this usually takes 1–3 minutes');
  while (!operation.done) {
    await new Promise(r => setTimeout(r, 10_000));
    try {
      operation = await ai.operations.getVideosOperation({ operation });
    } catch (e) {
      throw friendlyError(e);
    }
  }

  if (operation.error) {
    throw friendlyError(String(operation.error.message || 'Video generation failed'));
  }
  const response = operation.response;
  const uri = response?.generatedVideos?.[0]?.video?.uri;
  if (!uri) {
    const why = response?.raiMediaFilteredReasons?.[0];
    throw new Error(why ? `Google's safety filters blocked the video: ${why}` : "No video came back. Google's safety filters may have blocked it; try another image or description.");
  }

  onStatus?.('Downloading the video…');
  const blob = await fetchVideo(uri, apiKey);
  return { url: URL.createObjectURL(blob), blob, model: video, looped };
}
