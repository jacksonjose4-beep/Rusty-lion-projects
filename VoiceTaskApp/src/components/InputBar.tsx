import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTodosStore }    from '../store/useTodosStore';
import { useThoughtsStore } from '../store/useThoughtsStore';
import { useDraftsStore }   from '../store/useDraftsStore';
import { ping, parseTranscript } from '../services/ollamaService';
import { createItemFromOllamaResult } from '../utils/itemCreator';
import ReminderModal from './ReminderModal';
import VoiceRecorder from './VoiceRecorder';

type Category    = 'todo' | 'reminder' | 'thought';
type InputMode   = 'text' | 'voice';
type SendingState = 'idle' | 'processing';

interface Props {
  defaultCategory?: Category;
  onCreated?: () => void;
}

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'todo',     label: 'Todo',    icon: '✓'  },
  { key: 'reminder', label: 'Remind',  icon: '🔔' },
  { key: 'thought',  label: 'Thought', icon: '💭' },
];

export default function InputBar({ defaultCategory, onCreated }: Props) {
  const [text,              setText]              = useState('');
  const [category,          setCategory]          = useState<Category>(defaultCategory ?? 'todo');
  const [inputMode,         setInputMode]         = useState<InputMode>('text');
  const [sendingState,      setSendingState]       = useState<SendingState>('idle');
  const [statusMsg,         setStatusMsg]          = useState('');

  // Reminder modal state — used for both Ollama-parsed and offline-fallback reminders
  const [showReminderModal,  setShowReminderModal]  = useState(false);
  const [pendingReminderText, setPendingReminderText] = useState('');

  const inputRef = useRef<TextInput>(null);

  const addTodo    = useTodosStore((s) => s.addTodo);
  const addThought = useThoughtsStore((s) => s.addThought);
  const addDraft   = useDraftsStore((s) => s.addDraft);

  // ── Core send handler ──────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed    = text.trim();
    if (!trimmed) return;

    const sourceType = inputMode === 'voice' ? 'voice' as const : 'text' as const;

    // Clear input immediately so the user can keep typing
    setText('');
    setInputMode('text');
    Keyboard.dismiss();
    setSendingState('processing');

    try {
      const ollamaReachable = await ping();

      if (ollamaReachable) {
        // ── Ollama path ─────────────────────────────────────────────────────
        setStatusMsg('Parsing with AI…');
        const result = await parseTranscript(trimmed);
        const outcome = await createItemFromOllamaResult(result, sourceType);

        if (!outcome.created) {
          // Ollama said "reminder" but gave no datetime → ask user to pick one
          setPendingReminderText(outcome.needsReminderDate);
          setShowReminderModal(true);
        } else {
          onCreated?.();
        }
      } else {
        // ── Offline fallback ─────────────────────────────────────────────────
        await handleOfflineFallback(trimmed, sourceType);
      }
    } catch {
      // Ollama call failed (timeout, bad JSON, etc.) — treat as offline
      await handleOfflineFallback(trimmed, sourceType);
    } finally {
      setSendingState('idle');
      setStatusMsg('');
    }
  };

  // ── Offline / error fallback ───────────────────────────────────────────────
  const handleOfflineFallback = async (
    value: string,
    sourceType: 'voice' | 'text'
  ) => {
    if (defaultCategory === 'todo') {
      await addTodo(value);
      onCreated?.();
    } else if (defaultCategory === 'reminder') {
      // Show date picker with the raw text
      setPendingReminderText(value);
      setShowReminderModal(true);
    } else if (defaultCategory === 'thought') {
      await addThought(value, sourceType);
      onCreated?.();
    } else {
      // No default category and Ollama offline → queue as draft for later
      await addDraft(value);
      setStatusMsg('Saved as draft — will parse when Ollama is back online');
      setTimeout(() => setStatusMsg(''), 3000);
      onCreated?.();
    }
  };

  // ── Voice transcript received ──────────────────────────────────────────────
  const handleTranscript = (transcript: string) => {
    if (!transcript.trim()) return;
    setInputMode('text');
    setText(transcript);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleVoiceError = (msg: string) => {
    setInputMode('text');
    Alert.alert('Voice error', msg);
  };

  // ── Reminder modal callbacks ───────────────────────────────────────────────
  const handleReminderScheduled = () => {
    setShowReminderModal(false);
    setPendingReminderText('');
    onCreated?.();
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const placeholder =
    category === 'todo'
      ? 'Add a task for today…'
      : category === 'reminder'
      ? 'What do you want to be reminded of?'
      : 'Capture a thought…';

  const toggleMode = () => {
    setInputMode((m) => (m === 'text' ? 'voice' : 'text'));
    Keyboard.dismiss();
  };

  const isBusy = sendingState === 'processing';

  return (
    <>
      <View style={styles.container}>
        {/* Category chips — hidden when defaultCategory is locked */}
        {!defaultCategory && (
          <View style={styles.chips}>
            {CATEGORIES.map(({ key, label, icon }) => (
              <TouchableOpacity
                key={key}
                style={[styles.chip, category === key && styles.chipActive]}
                onPress={() => setCategory(key)}
                activeOpacity={0.7}
                disabled={isBusy}
              >
                <Text style={[styles.chipText, category === key && styles.chipTextActive]}>
                  {icon} {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Processing overlay ──────────────────────────────────────── */}
        {isBusy ? (
          <View style={styles.processingRow}>
            <ActivityIndicator size="small" color="#6366f1" />
            <Text style={styles.processingText}>{statusMsg || 'Parsing with AI…'}</Text>
          </View>
        ) : (
          <>
            {/* Voice recorder */}
            {inputMode === 'voice' && (
              <VoiceRecorder onTranscript={handleTranscript} onError={handleVoiceError} />
            )}

            {/* Text input row */}
            {inputMode === 'text' && (
              <View style={styles.row}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  placeholder={placeholder}
                  placeholderTextColor="#475569"
                  multiline
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
                  onPress={handleSend}
                  disabled={!text.trim()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sendIcon}>↑</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Status message (draft saved, etc.) */}
            {statusMsg !== '' && (
              <Text style={styles.statusMsg}>{statusMsg}</Text>
            )}

            {/* Mode toggle */}
            <TouchableOpacity style={styles.modeToggle} onPress={toggleMode} activeOpacity={0.7}>
              <Text style={styles.modeToggleText}>
                {inputMode === 'text' ? '🎤 Use voice' : '⌨️ Use keyboard'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Reminder date/time picker — used for both Ollama & offline paths */}
      <ReminderModal
        visible={showReminderModal}
        text={pendingReminderText}
        onClose={() => { setShowReminderModal(false); setPendingReminderText(''); }}
        onScheduled={handleReminderScheduled}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive:     { backgroundColor: '#312e81', borderColor: '#6366f1' },
  chipText:       { fontSize: 13, color: '#64748b', fontWeight: '500' },
  chipTextActive: { color: '#a5b4fc', fontWeight: '700' },

  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  processingText: { color: '#94a3b8', fontSize: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#e2e8f0',
    fontSize: 15,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#334155' },
  sendIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },

  statusMsg: {
    fontSize: 12,
    color: '#6366f1',
    textAlign: 'center',
    marginTop: 6,
  },
  modeToggle: {
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  modeToggleText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
});
