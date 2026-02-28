/**
 * whisperService — on-device speech transcription via whisper.rn
 *
 * NOTE: whisper.rn is a native module and requires a custom development build.
 * It will NOT work inside Expo Go. Build with:
 *   npx expo run:android   (or)   npx expo run:ios
 *
 * Models are downloaded once and stored in the app's document directory.
 */

import * as FileSystem from 'expo-file-system';
import { getSetting } from './db';

// ─── Whisper module (native — may not load in Expo Go) ───────────────────────

let _initWhisper: ((opts: { filePath: string }) => Promise<any>) | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _initWhisper = require('whisper.rn').initWhisper;
} catch {
  // Running in Expo Go or environment without native modules — transcription
  // will fall back to a stub that returns an empty string.
  console.warn('[Whisper] Native module not available. Build a dev client to use STT.');
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MODEL_DIR = (FileSystem.documentDirectory ?? '') + 'whisper/';

// GGML quantised models from whisper.cpp (hosted on Hugging Face)
const MODEL_URLS: Record<string, string> = {
  tiny:  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
  base:  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
  small: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
};

// ─── State ───────────────────────────────────────────────────────────────────

let whisperContext: any | null = null;
let loadedModelSize: string | null = null;

// ─── Model management ────────────────────────────────────────────────────────

export function modelPath(size: string): string {
  return `${MODEL_DIR}ggml-${size}.en.bin`;
}

export async function isModelDownloaded(size: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(modelPath(size));
  return info.exists;
}

export async function downloadModel(
  size: string,
  onProgress?: (fraction: number) => void
): Promise<void> {
  await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  const dest = modelPath(size);
  const url  = MODEL_URLS[size];
  if (!url) throw new Error(`Unknown model size: ${size}`);

  const resumable = FileSystem.createDownloadResumable(
    url,
    dest,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite > 0) {
        onProgress?.(totalBytesWritten / totalBytesExpectedToWrite);
      }
    }
  );

  const result = await resumable.downloadAsync();
  if (!result?.uri) throw new Error('Download failed — no URI returned');
}

export async function deleteModel(size: string): Promise<void> {
  const path = modelPath(size);
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) await FileSystem.deleteAsync(path);
  if (loadedModelSize === size) {
    whisperContext = null;
    loadedModelSize = null;
  }
}

// ─── Model loading ───────────────────────────────────────────────────────────

export async function loadModel(size?: string): Promise<void> {
  if (!_initWhisper) return; // Not available in Expo Go

  const modelSize = size ?? (await getSetting('whisperModel', 'base'));
  if (loadedModelSize === modelSize && whisperContext) return; // Already loaded

  const path = modelPath(modelSize);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) throw new Error(`Model "${modelSize}" not downloaded yet.`);

  whisperContext = await _initWhisper({ filePath: path });
  loadedModelSize = modelSize;
}

export function isModelLoaded(): boolean {
  return whisperContext !== null;
}

// ─── Transcription ───────────────────────────────────────────────────────────

/**
 * Transcribe a recorded audio file (m4a / wav).
 * Returns the transcript string, or throws if no model is loaded.
 */
export async function transcribeAudio(audioUri: string): Promise<string> {
  if (!whisperContext) {
    if (!_initWhisper) {
      // Expo Go fallback — return placeholder so the rest of the pipeline works
      return '(voice input not available — requires dev build)';
    }
    throw new Error('Whisper model not loaded. Download and load a model in Settings.');
  }

  const { promise } = whisperContext.transcribe(audioUri, {
    language: 'en',
    maxLen: 0,        // no max token length
    tokenTimestamps: false,
  });

  const { result } = await promise;
  return (result ?? '').trim();
}

// ─── Auto-load on startup ────────────────────────────────────────────────────

/**
 * Call this once at app start. Silently skips if model isn't downloaded yet.
 */
export async function tryAutoLoad(): Promise<void> {
  try {
    const size = await getSetting('whisperModel', 'base');
    const downloaded = await isModelDownloaded(size);
    if (downloaded) await loadModel(size);
  } catch {
    // Non-fatal — user will see an error when they try to record
  }
}
