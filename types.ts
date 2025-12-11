export type AppMode = 'animate' | 'edit';

export interface GeneratedVideo {
  uri: string;
  mimeType: string;
}

export interface ProcessingState {
  isLoading: boolean;
  statusMessage: string;
  error?: string;
}

export type AspectRatio = '16:9' | '9:16';
