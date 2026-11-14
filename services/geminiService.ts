// Talks to Google's Gemini API straight from the browser, with the user's own
// API key. There is no server of ours in between: the key and the images go
// only to Google (generativelanguage.googleapis.com).
//
// Video: Gemini Omni Flash, through the Interactions API. (Veo was the Gemini
// API's video model until its previews were shut down on 2026-10-22.)

import { GoogleGenAI } from "@google/genai";
import { ANIMATION_PROMPT } from "../prompts/animation";
import { AspectRatio } from "../types";

const API = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiOptions {
  apiKey: string;
  onStatus?: (message: string) => void;
}

export interface VideoOptions extends GeminiOptions {
  aspectRatio: AspectRatio;
  loop: boolean;
  seconds: number;
}

/** Google's list price for Omni Flash video at 720p (Nov 2026), for the estimate shown before generating. */
export const VIDEO_USD_PER_SECOND = 0.07;
export const VIDEO_SECONDS = [4, 6, 8] as const;

// Google renames and retires models, so the app asks the API which models this
// key can see and takes the first match from each list. Newest and best first.
// The motion description is one short sentence: a Lite model writes it in ~2 s,
// where full Flash thinks for ~25 s.
const PREFERRED = {
  text: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-flash-latest'],
  image: ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image'],
  omni: ['gemini-omni-1.2-flash', 'gemini-omni-1.1-flash'],
} as const;

type Kind = keyof typeof PREFERRED;
export type Models = { text: string; image: string; omni: string | null };

const BILLING = "needs billing turned on for the key's project in Google AI Studio";

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
      return {
        text,
        image,
        omni: pick('omni', 'generateContent', /^gemini-omni-[\d.]+-flash$/),
      };
    })();
    p.catch(() => modelCache.delete(apiKey));
    modelCache.set(apiKey, p);
  }
  return p;
}

// ---------- key check ----------

export interface Capability { ok: boolean; why?: string; model?: string }
export interface Capabilities { animate: Capability; edit: Capability }

/**
 * Tries a model with a deliberately invalid request, so nothing is generated
 * or billed. Google checks quota first: a free-tier project without access
 * gets "limit: 0" (429), a project that can use the model gets "invalid
 * argument" (400).
 */
async function probe(call: () => Promise<unknown>, model: string): Promise<Capability> {
  try {
    await call();
    return { ok: true, model };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/limit: 0\b/.test(msg)) return { ok: false, why: BILLING, model };
    if (/RESOURCE_EXHAUSTED|429/.test(msg)) return { ok: false, why: "its quota is used up right now; try again later", model };
    if (/INVALID_ARGUMENT|\b400\b/.test(msg)) return { ok: true, model };
    return { ok: false, why: friendlyError(e).message, model };
  }
}

async function interactions(apiKey: string, body: object): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${API}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw friendlyError(e);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

/** What this key can do, without generating anything. Throws if the key itself is bad. */
export async function checkKey(apiKey: string): Promise<Capabilities> {
  modelCache.delete(apiKey);
  const models = await resolveModels(apiKey);
  const ai = client(apiKey);

  const edit = probe(() => ai.models.generateContent({
    model: models.image,
    contents: 'probe',
    config: { responseModalities: ['VIDEO' as any] },   // invalid on purpose
  }), models.image);

  let animate: Promise<Capability>;
  if (models.omni) {
    animate = probe(() => interactions(apiKey, {
      model: models.omni,
      input: [{ type: 'text', text: 'probe' }],
      response_format: { type: 'video', duration: '1s' },   // invalid on purpose (3–15 s)
      store: false,
    }), models.omni);
  } else {
    animate = Promise.resolve({ ok: false, why: "no Google video model is available to this key" });
  }
  const [a, e] = await Promise.all([animate, edit]);
  return { animate: a, edit: e };
}

/** Turns API errors into something a person can act on. */
export function friendlyError(error: unknown): Error {
  const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
  if (/API key not valid|API_KEY_INVALID|UNAUTHENTICATED|\b401\b/i.test(msg)) {
    return new Error("Google rejected this API key. Check it in Settings.");
  }
  if (/limit: 0\b/.test(msg)) {
    return new Error(`This model isn't included in Google's free tier: it ${BILLING}.`);
  }
  if (/billing|requires a paid|FAILED_PRECONDITION|PERMISSION_DENIED|\b403\b/i.test(msg)) {
    return new Error(`This key's project can't use this model: it ${BILLING}.`);
  }
  if (/RESOURCE_EXHAUSTED|quota|\b429\b/i.test(msg)) {
    return new Error("Your key hit its quota or rate limit. Wait a minute, or check your limits in Google AI Studio.");
  }
  if (/NOT_FOUND|\b404\b|not found/i.test(msg)) {
    return new Error("Google says the model wasn't found for this key. It may have been renamed; reload the page to pick again.");
  }
  if (/SAFETY|blocked|responsible AI|RAI|PROHIBITED/i.test(msg)) {
    return new Error("Google's safety filters blocked this request. Try another image or description.");
  }
  if (/Failed to fetch|NetworkError|network/i.test(msg)) {
    return new Error("Couldn't reach Google. Check your connection and try again.");
  }
  const m = msg.match(/"message"\s*:\s*"([^"]+)"/);
  return new Error(m ? m[1] : msg || "Something went wrong.");
}

function imagePart(base64Image: string, mimeType: string) {
  return { inlineData: { data: base64Image, mimeType } };
}

// ---------- text and image ----------

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

// ---------- video ----------

export interface VideoResult { url: string; blob: Blob; model: string; looped: boolean }

/** Fetches a video file into memory, so it plays and saves without the key in a URL. */
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

function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Finds the video in an Interactions response (inline base64, or a file URI). */
function findVideo(node: any): { data?: string; uri?: string; mime?: string } | null {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'video' && (node.data || node.uri)) return { data: node.data, uri: node.uri, mime: node.mime_type };
  for (const v of Array.isArray(node) ? node : Object.values(node)) {
    const found = findVideo(v);
    if (found) return found;
  }
  return null;
}

const LOOP_HINT = " The video loops seamlessly: it starts and ends on exactly this image, with no jump.";

async function omniVideo(model: string, base64Image: string, mimeType: string, prompt: string, o: VideoOptions): Promise<VideoResult> {
  const image = { type: 'image', data: base64Image, mime_type: mimeType };
  // Loop: the same image as first and last frame (supported for 3–10 s).
  const input = o.loop
    ? [image, image, { type: 'text', text: prompt + LOOP_HINT }]
    : [image, { type: 'text', text: prompt }];
  o.onStatus?.('Gemini Omni is animating… this usually takes 1–3 minutes');
  let response: any;
  try {
    response = await interactions(o.apiKey, {
      model,
      input,
      response_format: { type: 'video', aspect_ratio: o.aspectRatio, resolution: '720p', duration: `${o.seconds}s` },
      background: false,
      store: false,
      stream: false,
    });
  } catch (e) {
    throw friendlyError(e);
  }
  const video = findVideo(response);
  if (!video) {
    throw new Error("No video came back. Google's safety filters may have blocked it; try another image or description.");
  }
  o.onStatus?.('Downloading the video…');
  const blob = video.data
    ? base64ToBlob(video.data, video.mime || 'video/mp4')
    : await fetchVideo(video.uri!, o.apiKey);
  return { url: URL.createObjectURL(blob), blob, model, looped: o.loop };
}

/** Animates the image with the key's video model. Returns a blob: URL of the MP4. */
export async function generateVideo(base64Image: string, mimeType: string, prompt: string, options: VideoOptions): Promise<VideoResult> {
  const models = await resolveModels(options.apiKey);
  if (!models.omni) throw new Error("This key can't make videos: Google's video model (Gemini Omni Flash) isn't available to it.");
  return omniVideo(models.omni, base64Image, mimeType, prompt, options);
}
