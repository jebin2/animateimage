import { configureAuthService } from './authService';
import { configureUserIdService } from './userIdService';
import { configureEventService } from './eventService';
import { configureUsageService } from './usageService';
import { configureGeminiService } from './geminiService';
import { configureGoogleAuth } from './googleAuthService';

// API Base URL - using local dev server
const API_BASE_URL = 'http://localhost:8000';

// Google Client ID
const GOOGLE_CLIENT_ID = '212074481946-sadifngeab8njbmvf1u8a6ilnvcugm7b.apps.googleusercontent.com';

export function initServices() {
    // Configure User ID Service
    configureUserIdService({
        cookieName: 'animateimage_userid',
        dbName: 'animateimage_user'
    });

    // Configure Auth Service
    configureAuthService({
        baseUrl: API_BASE_URL
    });

    // Configure Event Service
    configureEventService({
        dbName: 'animateimage_events'
    });

    // Configure Usage Service
    configureUsageService({
        syncUrl: `${API_BASE_URL}/blink`
    });

    // Configure Gemini Service (dual-mode: client API key or server credits)
    configureGeminiService({
        apiBaseUrl: API_BASE_URL,
        defaultAnimationPrompt: `Analyze this image and create a concise prompt for a video generation model to create a cinematic, loopable animation. Identify the most interesting moving element (e.g., flowing water, swaying trees, flickering light, clouds) and describe the motion. Output ONLY the description, under 30 words.`
    });

    // Configure Google Auth Service
    configureGoogleAuth({
        clientId: GOOGLE_CLIENT_ID,
        apiBaseUrl: API_BASE_URL,
        storagePrefix: 'animateimage_auth'
    });
}

