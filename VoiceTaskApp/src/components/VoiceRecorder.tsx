import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { transcribeAudio, isModelLoaded } from '../services/whisperService';

type RecordState = 'idle' | 'recording' | 'transcribing';

interface Props {
  onTranscript: (text: string) => void;
  onError: (msg: string) => void;
}

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  android: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
    extension: '.m4a',
  },
  ios: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
    extension: '.m4a',
  },
};

export default function VoiceRecorder({ onTranscript, onError }: Props) {
  const [state, setState] = useState<RecordState>('idle');
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── Pulse animation ────────────────────────────────────────────────────────
  const startPulse = useCallback(() => {
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseLoopRef.current?.stop();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  // ── Audio permissions ──────────────────────────────────────────────────────
  useEffect(() => {
    Audio.requestPermissionsAsync();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
    };
  }, []);

  // ── Recording start ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current = recording;
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      startPulse();
    } catch (err: any) {
      onError(err?.message ?? 'Could not start recording');
    }
  }, [startPulse, onError]);

  // ── Recording stop + transcription ────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    if (state !== 'recording') return;

    timerRef.current && clearInterval(timerRef.current);
    stopPulse();
    setState('transcribing');

    const recording = recordingRef.current;
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      if (!uri) throw new Error('No audio URI after recording');

      if (!isModelLoaded()) {
        throw new Error('Whisper model not loaded.\nGo to Settings → download a model first.');
      }

      const transcript = await transcribeAudio(uri);
      onTranscript(transcript);
    } catch (err: any) {
      onError(err?.message ?? 'Transcription failed');
    } finally {
      recordingRef.current = null;
      setState('idle');
    }
  }, [state, stopPulse, onTranscript, onError]);

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (state === 'transcribing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.transcribingLabel}>Transcribing…</Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      {state === 'recording' && (
        <Text style={styles.duration}>{formatDuration(duration)}</Text>
      )}

      {/* Outer glow ring — only visible while recording */}
      <Animated.View
        style={[
          styles.ring,
          state === 'recording' && styles.ringActive,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />

      <TouchableOpacity
        style={[styles.micButton, state === 'recording' && styles.micButtonActive]}
        onPressIn={startRecording}
        onPressOut={stopRecording}
        activeOpacity={0.8}
        delayPressIn={0}
      >
        <Text style={styles.micIcon}>{state === 'recording' ? '■' : '🎤'}</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        {state === 'idle' ? 'Hold to speak' : 'Release to stop'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  duration: {
    fontSize: 16,
    color: '#ef4444',
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: 1,
  },
  ring: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ringActive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  micButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: '#450a0a',
    borderColor: '#ef4444',
  },
  micIcon: {
    fontSize: Platform.OS === 'ios' ? 28 : 24,
  },
  transcribingLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
  hint: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
  },
});
