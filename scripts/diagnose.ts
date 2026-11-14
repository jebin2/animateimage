// Runs the app's own Gemini code from the terminal, step by step, with timings.
//   bun scripts/diagnose.ts            models + key check + motion prompt (cheap)
//   bun scripts/diagnose.ts --video    also makes one Veo clip (billed) -> scripts/out.mp4
//   bun scripts/diagnose.ts --edit     also one image edit (billed)     -> scripts/out.png
// Key: GEMINI_API_KEY, or the GNOME keyring entry "service gemini account api".
import { GoogleGenAI } from "@google/genai";
import { resolveModels, generateAnimationPrompt, generateVideo, editImage } from "../services/geminiService";

const key = process.env.GEMINI_API_KEY ||
  Bun.spawnSync(["secret-tool", "lookup", "service", "gemini", "account", "api"]).stdout.toString().trim();
if (!key) { console.error("No key: secret-tool store --label='Gemini API key' service gemini account api"); process.exit(1); }

const t0 = Date.now();
const log = (m: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s] ${m}`);

// A small test image: the app's own screenshot.
const img = Buffer.from(await Bun.file(new URL("../public/image.png", import.meta.url)).arrayBuffer()).toString("base64");

log("listing models…");
const ai = new GoogleGenAI({ apiKey: key });
const all: string[] = [];
for await (const m of await ai.models.list({ config: { pageSize: 1000 } })) all.push(`${m.name}  [${(m.supportedActions || []).join(",")}]`);
log(`${all.length} models; veo / image / flash ones:`);
for (const l of all.filter(l => /veo|image|flash/.test(l))) console.log("         " + l);

const models = await resolveModels(key);
log(`app picks: ${JSON.stringify(models)}`);

const onStatus = (s: string) => log(`status: ${s}`);
const prompt = await generateAnimationPrompt(img, "image/png", { apiKey: key, onStatus });
log(`motion prompt: ${prompt}`);

if (process.argv.includes("--edit")) {
  const url = await editImage(img, "image/png", "Make it look like a watercolor painting", { apiKey: key, onStatus });
  await Bun.write(new URL("./out.png", import.meta.url), Buffer.from(url.split(",")[1], "base64"));
  log("edit saved to scripts/out.png");
}
if (process.argv.includes("--video")) {
  const r = await generateVideo(img, "image/png", prompt, { apiKey: key, aspectRatio: "16:9", loop: true, onStatus });
  await Bun.write(new URL("./out.mp4", import.meta.url), r.blob);
  log(`video saved to scripts/out.mp4 (${r.blob.size} bytes, model ${r.model}, looped ${r.looped})`);
}
log("done");
