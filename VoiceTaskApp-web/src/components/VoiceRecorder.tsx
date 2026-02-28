import React, { useState, useCallback } from 'react';
import { startListening, stopListening, isSpeechSupported } from '../services/speechService';

type RecordState = 'idle' | 'recording' | 'transcribing';

interface Props {
  onTranscript: (text: string) => void;
  onError: (msg: string) => void;
}

export default function VoiceRecorder({ onTranscript, onError }: Props) {
  const [state,    setState]    = useState<RecordState>('idle');

  const startRecording = useCallback(() => {
    if (!isSpeechSupported()) {
      onError('Speech recognition is not supported in this browser. Try Chrome or Safari.');
      return;
    }

    setState('recording');

    startListening(
      (transcript) => {
        setState('idle');
        onTranscript(transcript);
      },
      () => {
        setState('idle');
      },
      (msg) => {
        setState('idle');
        onError(msg);
      }
    );
  }, [onTranscript, onError]);

  const stopRecording = useCallback(() => {
    if (state !== 'recording') return;
    setState('transcribing');
    stopListening();
  }, [state]);

  if (state === 'transcribing') {
    return (
      <div className="flex flex-col items-center justify-center py-4 gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Transcribing…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-3 gap-2">
      {/* Pulse ring */}
      <div className="relative flex items-center justify-center">
        {state === 'recording' && (
          <div className="absolute w-20 h-20 rounded-full border-2 border-red-500 bg-red-500/10 pulse-ring" />
        )}
        <button
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerLeave={stopRecording}
          className={`relative w-16 h-16 rounded-full border-2 flex items-center justify-center text-2xl transition-colors ${
            state === 'recording'
              ? 'bg-red-950 border-red-500'
              : 'bg-slate-800 border-slate-500'
          }`}
        >
          {state === 'recording' ? '■' : '🎤'}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        {state === 'idle' ? 'Hold to speak' : 'Release to stop'}
      </p>
    </div>
  );
}
