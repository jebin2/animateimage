// Prompts, following Google's Gemini Omni Flash prompt guide:
// - specific motion: camera movement, subject motion, environmental effects
//   ("make it move" gives weak results);
// - Omni makes several shots by default: ask for one continuous shot;
// - audio comes with every video and is steered only by the prompt.

/** For Gemini (vision): writes the motion part when the user leaves it empty. */
export const ANIMATION_PROMPT = `You write prompts for an image-to-video model that animates this exact photo.
Describe, in 40 to 70 words, plain present tense, one paragraph:
- what in the image naturally moves (water, clouds, leaves, hair, fabric, smoke, light, people or animals) and exactly how: direction, speed, gentle and realistic;
- one subtle camera instruction (locked-off camera, or a very slow push-in);
- small environmental effects that fit (drifting mist, flickering light, ripples).
Only what is already in the image: no new objects, people, text or scene changes.
Output only the prompt.`;

/** For Gemini (vision), loop mode: motion that can return to where it started. */
export const LOOP_ANIMATION_PROMPT = ANIMATION_PROMPT.replace(
  '- one subtle camera instruction (locked-off camera, or a very slow push-in);',
  '- a locked-off, perfectly still camera; prefer repeating motion (flowing, swaying, rippling, flickering, breathing) that can end exactly where it began;',
);

export type Sound = 'ambient' | 'music' | 'quiet';

export const SOUND_LABELS: Record<Sound, string> = {
  ambient: 'Natural sound',
  music: 'Calm music',
  quiet: 'Quiet',
};

const SOUND: Record<Sound, string> = {
  ambient: 'Sound design: natural ambient sound that matches the scene. No music. No dialogue.',
  music: 'Sound design: calm background music with soft ambient sound from the scene. No dialogue.',
  quiet: 'Sound design: near silence, only very faint room tone. No music. No sound effects. No dialogue.',
};

/** The full video prompt: the user's (or Gemini's) motion, wrapped in what Omni needs. */
export function buildVideoPrompt(motion: string, loop: boolean, sound: Sound): string {
  const parts = [
    'In a single continuous shot with no scene cuts, animate this image.',
    motion.trim(),
    'Keep the scene, subjects, framing, colours and lighting of the image; the image is the first frame.',
  ];
  if (loop) {
    parts.push('Locked-off camera, no camera movement. The motion settles back so the last frame is exactly the first image, for a seamless loop.');
  }
  parts.push(SOUND[sound]);
  return parts.join(' ');
}

/** For Gemini (image): wraps the user's edit so only the asked change is made. */
export function buildEditPrompt(instructions: string): string {
  const what = instructions.trim() || 'Gently improve this photo: clean up noise, balance exposure and colour';
  return `${what}. Keep everything else in the image the same: composition, subjects, faces, colours and lighting. Return the edited image.`;
}
