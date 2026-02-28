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
} from 'react-native';
import { useTodosStore } from '../store/useTodosStore';
import { useThoughtsStore } from '../store/useThoughtsStore';
import ReminderModal from './ReminderModal';
import VoiceRecorder from './VoiceRecorder';

type Category = 'todo' | 'reminder' | 'thought';
type InputMode = 'text' | 'voice';

interface Props {
  /** Pre-select a category and hide the selector (used per-screen) */
  defaultCategory?: Category;
  /** Called after an item is created */
  onCreated?: () => void;
}

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'todo',     label: 'Todo',    icon: '✓'  },
  { key: 'reminder', label: 'Remind',  icon: '🔔' },
  { key: 'thought',  label: 'Thought', icon: '💭' },
];

export default function InputBar({ defaultCategory, onCreated }: Props) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<Category>(defaultCategory ?? 'todo');
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [showReminderModal, setShowReminderModal] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const addTodo = useTodosStore((s) => s.addTodo);
  const addThought = useThoughtsStore((s) => s.addThought);

  // ── Submit (text mode) ─────────────────────────────────────────────────────
  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (category === 'reminder') {
      Keyboard.dismiss();
      setShowReminderModal(true);
      return;
    }

    if (category === 'todo') {
      addTodo(trimmed);
    } else {
      addThought(trimmed, 'text');
    }

    setText('');
    onCreated?.();
  };

  // ── Voice transcript received ──────────────────────────────────────────────
  const handleTranscript = (transcript: string) => {
    if (!transcript.trim()) return;
    // Switch back to text mode so the user can review / edit the transcript
    setInputMode('text');
    setText(transcript);
    // Small delay so the TextInput is rendered before we focus it
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleVoiceError = (msg: string) => {
    setInputMode('text');
    Alert.alert('Voice error', msg);
  };

  // ── Reminder modal ─────────────────────────────────────────────────────────
  const handleReminderScheduled = () => {
    setShowReminderModal(false);
    setText('');
    onCreated?.();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
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
              >
                <Text style={[styles.chipText, category === key && styles.chipTextActive]}>
                  {icon} {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Voice recorder — shown when in voice mode */}
        {inputMode === 'voice' && (
          <VoiceRecorder onTranscript={handleTranscript} onError={handleVoiceError} />
        )}

        {/* Text input row — shown when in text mode */}
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

        {/* Mode toggle — always visible */}
        <TouchableOpacity style={styles.modeToggle} onPress={toggleMode} activeOpacity={0.7}>
          <Text style={styles.modeToggleText}>
            {inputMode === 'text' ? '🎤 Use voice' : '⌨️ Use keyboard'}
          </Text>
        </TouchableOpacity>
      </View>

      <ReminderModal
        visible={showReminderModal}
        text={text}
        onClose={() => setShowReminderModal(false)}
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
  chipActive: {
    backgroundColor: '#312e81',
    borderColor: '#6366f1',
  },
  chipText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#a5b4fc',
    fontWeight: '700',
  },
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
  sendBtnDisabled: {
    backgroundColor: '#334155',
  },
  sendIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
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
