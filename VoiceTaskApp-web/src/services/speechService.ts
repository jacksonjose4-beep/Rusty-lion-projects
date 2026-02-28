/**
 * speechService — wraps the Web Speech API (SpeechRecognition).
 *
 * Works in:
 *   - Chrome / Edge (desktop + Android)  → window.SpeechRecognition
 *   - Safari iOS 14.5+                   → window.webkitSpeechRecognition
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyWindow = typeof window & Record<string, any>;

let recognition: any = null;

export function isSpeechSupported(): boolean {
  const w = window as AnyWindow;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function startListening(
  onResult: (transcript: string) => void,
  onEnd: () => void,
  onError: (msg: string) => void
): void {
  const w = window as AnyWindow;
  const SpeechRecognitionClass = w.SpeechRecognition ?? w.webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    onError('Speech recognition is not supported in this browser. Try Chrome or Safari.');
    return;
  }

  recognition = new SpeechRecognitionClass();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  let finalTranscript = '';

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      }
    }
  };

  recognition.onend = () => {
    const result = finalTranscript.trim();
    if (result) onResult(result);
    onEnd();
    recognition = null;
  };

  recognition.onerror = (event: any) => {
    if (event.error === 'no-speech') {
      onEnd();
    } else if (event.error === 'not-allowed') {
      onError('Microphone access was denied. Please allow microphone access and try again.');
    } else {
      onError(`Speech recognition error: ${event.error}`);
    }
    recognition = null;
  };

  recognition.start();
}

export function stopListening(): void {
  if (recognition) {
    recognition.stop();
  }
}
