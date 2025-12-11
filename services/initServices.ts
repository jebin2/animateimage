import { configureAuthService } from './authService';
import { configureUserIdService } from './userIdService';
import { configureEventService } from './eventService';
import { configureUsageService } from './usageService';
import { configureGeminiService } from './geminiService';

export function initServices() {
    // Configure User ID Service
    configureUserIdService({
        cookieName: 'animateimage_userid',
        dbName: 'animateimage_user'
    });

    // Configure Auth Service
    configureAuthService({
        baseUrl: 'https://jebin2-apigateway.hf.space'
    });

    // Configure Event Service
    configureEventService({
        dbName: 'animateimage_events'
    });

    // Configure Usage Service
    configureUsageService({
        syncUrl: 'https://jebin2-apigateway.hf.space/blink'
    });

    // Configure Gemini Service
    configureGeminiService({
        defaultAnimationPrompt: `Analyze this image and create a concise prompt for a video generation model to create a cinematic, loopable animation. Identify the most interesting moving element (e.g., flowing water, swaying trees, flickering light, clouds) and describe the motion. Output ONLY the description, under 30 words.`
    });
}
