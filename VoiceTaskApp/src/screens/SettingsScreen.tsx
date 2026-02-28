import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import * as db from '../services/db';

const OLLAMA_MODELS = ['phi3:mini', 'llama3.2:3b', 'mistral:7b'];
const WHISPER_SIZES = ['tiny', 'base', 'small'] as const;

type WhisperSize = (typeof WHISPER_SIZES)[number];

export default function SettingsScreen() {
  const [ollamaUrl, setOllamaUrl] = useState('http://192.168.1.x:11434');
  const [ollamaModel, setOllamaModel] = useState('phi3:mini');
  const [whisperModel, setWhisperModel] = useState<WhisperSize>('base');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  useEffect(() => {
    (async () => {
      setOllamaUrl(await db.getSetting('ollamaUrl', 'http://192.168.1.x:11434'));
      setOllamaModel(await db.getSetting('ollamaModel', 'phi3:mini'));
      setWhisperModel((await db.getSetting('whisperModel', 'base')) as WhisperSize);
    })();
  }, []);

  const save = async (key: string, value: string) => {
    await db.setSetting(key, value);
  };

  const testConnection = async () => {
    setConnectionStatus('idle');
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`, { method: 'GET' });
      setConnectionStatus(res.ok ? 'ok' : 'error');
    } catch {
      setConnectionStatus('error');
    }
  };

  const confirmClearAll = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all todos, reminders, thoughts, and drafts.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Everything', style: 'destructive', onPress: () => {} },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        {/* ── Ollama ─────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Ollama (LLM)</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Base URL</Text>
          <TextInput
            style={styles.input}
            value={ollamaUrl}
            onChangeText={(v) => { setOllamaUrl(v); save('ollamaUrl', v); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.x.x:11434"
            placeholderTextColor="#475569"
          />

          <Text style={styles.label}>Model</Text>
          <View style={styles.pills}>
            {OLLAMA_MODELS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.pill, ollamaModel === m && styles.pillActive]}
                onPress={() => { setOllamaModel(m); save('ollamaModel', m); }}
              >
                <Text style={[styles.pillText, ollamaModel === m && styles.pillTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.testBtn} onPress={testConnection}>
            <Text style={styles.testBtnText}>Test Connection</Text>
          </TouchableOpacity>
          {connectionStatus === 'ok' && (
            <Text style={styles.statusOk}>Connected successfully</Text>
          )}
          {connectionStatus === 'error' && (
            <Text style={styles.statusError}>Could not reach Ollama. Check URL and that Ollama is running.</Text>
          )}
        </View>

        {/* ── Whisper ────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Whisper (Speech-to-Text)</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Model Size</Text>
          <Text style={styles.hint}>Larger = more accurate, slower, more storage</Text>
          <View style={styles.pills}>
            {WHISPER_SIZES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.pill, whisperModel === s && styles.pillActive]}
                onPress={() => { setWhisperModel(s); save('whisperModel', s); }}
              >
                <Text style={[styles.pillText, whisperModel === s && styles.pillTextActive]}>
                  {s === 'tiny' ? 'Tiny (~75MB)' : s === 'base' ? 'Base (~150MB)' : 'Small (~500MB)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.testBtn}>
            <Text style={styles.testBtnText}>Download Model</Text>
          </TouchableOpacity>
        </View>

        {/* ── Danger zone ────────────────────────────── */}
        <Text style={styles.sectionHeader}>Data</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.dangerBtn} onPress={confirmClearAll}>
            <Text style={styles.dangerBtnText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#f1f5f9', marginBottom: 20 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  label: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  hint: { fontSize: 12, color: '#475569', marginTop: -4 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pillActive: { backgroundColor: '#4f46e5', borderColor: '#6366f1' },
  pillText: { fontSize: 13, color: '#94a3b8' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  testBtn: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  testBtnText: { color: '#e2e8f0', fontWeight: '600' },
  statusOk: { color: '#22c55e', fontSize: 13 },
  statusError: { color: '#ef4444', fontSize: 13 },
  dangerBtn: {
    backgroundColor: '#450a0a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  dangerBtnText: { color: '#fca5a5', fontWeight: '600' },
});
