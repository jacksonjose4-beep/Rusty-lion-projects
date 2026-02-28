import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as db from '../services/db';
import {
  isModelDownloaded,
  downloadModel,
  deleteModel,
  loadModel,
  isModelLoaded,
} from '../services/whisperService';

const OLLAMA_MODELS = ['phi3:mini', 'llama3.2:3b', 'mistral:7b'];
const WHISPER_SIZES = ['tiny', 'base', 'small'] as const;
type WhisperSize = (typeof WHISPER_SIZES)[number];

const WHISPER_SIZE_LABELS: Record<WhisperSize, string> = {
  tiny:  'Tiny  (~75 MB)',
  base:  'Base  (~150 MB)',
  small: 'Small (~500 MB)',
};

type DownloadState = 'idle' | 'downloading' | 'loading';

export default function SettingsScreen() {
  const [ollamaUrl,   setOllamaUrl]   = useState('http://192.168.1.x:11434');
  const [ollamaModel, setOllamaModel] = useState('phi3:mini');
  const [whisperModel, setWhisperModel] = useState<WhisperSize>('base');

  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  // Per-size download state
  const [downloadState,    setDownloadState]    = useState<DownloadState>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedSizes, setDownloadedSizes]   = useState<Record<string, boolean>>({});
  const [modelLoaded, setModelLoaded] = useState(false);

  // ── Load settings and check which models are on disk ─────────────────────
  const refreshDownloadedSizes = useCallback(async () => {
    const results: Record<string, boolean> = {};
    for (const size of WHISPER_SIZES) {
      results[size] = await isModelDownloaded(size);
    }
    setDownloadedSizes(results);
    setModelLoaded(isModelLoaded());
  }, []);

  useEffect(() => {
    (async () => {
      setOllamaUrl(   await db.getSetting('ollamaUrl',    'http://192.168.1.x:11434'));
      setOllamaModel( await db.getSetting('ollamaModel',  'phi3:mini'));
      setWhisperModel((await db.getSetting('whisperModel', 'base')) as WhisperSize);
      await refreshDownloadedSizes();
    })();
  }, [refreshDownloadedSizes]);

  const save = async (key: string, value: string) => {
    await db.setSetting(key, value);
  };

  // ── Ollama connection test ────────────────────────────────────────────────
  const testConnection = async () => {
    setConnectionStatus('idle');
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`, { method: 'GET' });
      setConnectionStatus(res.ok ? 'ok' : 'error');
    } catch {
      setConnectionStatus('error');
    }
  };

  // ── Whisper model download ────────────────────────────────────────────────
  const handleDownload = async (size: WhisperSize) => {
    setDownloadState('downloading');
    setDownloadProgress(0);

    try {
      await downloadModel(size, (p) => setDownloadProgress(p));

      setDownloadState('loading');
      await loadModel(size);
      await save('whisperModel', size);
      setWhisperModel(size);
      await refreshDownloadedSizes();
      setModelLoaded(true);
      Alert.alert('Done', `${size} model ready.`);
    } catch (err: any) {
      Alert.alert('Download failed', err?.message ?? String(err));
    } finally {
      setDownloadState('idle');
      setDownloadProgress(0);
    }
  };

  const handleDeleteModel = (size: WhisperSize) => {
    Alert.alert(
      'Delete model',
      `Remove the "${size}" Whisper model from your device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteModel(size);
            await refreshDownloadedSizes();
            setModelLoaded(isModelLoaded());
          },
        },
      ]
    );
  };

  const handleLoadModel = async (size: WhisperSize) => {
    try {
      setDownloadState('loading');
      await loadModel(size);
      await save('whisperModel', size);
      setWhisperModel(size);
      setModelLoaded(true);
    } catch (err: any) {
      Alert.alert('Load failed', err?.message ?? String(err));
    } finally {
      setDownloadState('idle');
    }
  };

  // ── Clear all data ────────────────────────────────────────────────────────
  const confirmClearAll = () => {
    Alert.alert(
      'Clear All Data',
      'This permanently deletes all todos, reminders, thoughts, and drafts.',
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

        {/* ── Ollama ──────────────────────────────────────────────────── */}
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

          <TouchableOpacity style={styles.actionBtn} onPress={testConnection}>
            <Text style={styles.actionBtnText}>Test Connection</Text>
          </TouchableOpacity>
          {connectionStatus === 'ok'    && <Text style={styles.statusOk}>Connected</Text>}
          {connectionStatus === 'error' && (
            <Text style={styles.statusError}>Could not reach Ollama. Check the URL and that Ollama is running on your PC.</Text>
          )}
        </View>

        {/* ── Whisper ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Whisper (Speech-to-Text)</Text>
        <Text style={styles.sectionNote}>
          Models are downloaded once and stored on-device. Larger = more accurate, slower.
        </Text>
        {WHISPER_SIZES.map((size) => {
          const downloaded = downloadedSizes[size];
          const isActive   = whisperModel === size;
          const busy       = downloadState !== 'idle';

          return (
            <View key={size} style={[styles.modelRow, isActive && styles.modelRowActive]}>
              <View style={styles.modelInfo}>
                <Text style={[styles.modelName, isActive && styles.modelNameActive]}>
                  {WHISPER_SIZE_LABELS[size]}
                  {isActive && isModelLoaded() ? ' · loaded ✓' : ''}
                </Text>
              </View>

              {!downloaded ? (
                <TouchableOpacity
                  style={[styles.smallBtn, busy && styles.smallBtnDisabled]}
                  onPress={() => !busy && handleDownload(size)}
                  disabled={busy}
                >
                  {downloadState === 'downloading' && isActive ? (
                    <Text style={styles.smallBtnText}>
                      {Math.round(downloadProgress * 100)}%
                    </Text>
                  ) : downloadState === 'loading' && isActive ? (
                    <ActivityIndicator size="small" color="#a5b4fc" />
                  ) : (
                    <Text style={styles.smallBtnText}>Download</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.modelActions}>
                  {!isActive && (
                    <TouchableOpacity
                      style={[styles.smallBtn, busy && styles.smallBtnDisabled]}
                      onPress={() => !busy && handleLoadModel(size)}
                      disabled={busy}
                    >
                      {downloadState === 'loading' ? (
                        <ActivityIndicator size="small" color="#a5b4fc" />
                      ) : (
                        <Text style={styles.smallBtnText}>Use</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.smallBtnDanger, busy && styles.smallBtnDisabled]}
                    onPress={() => !busy && handleDeleteModel(size)}
                    disabled={busy}
                  >
                    <Text style={styles.smallBtnDangerText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {/* ── Data ────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Data</Text>
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
    marginBottom: 6,
    marginTop: 4,
  },
  sectionNote: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 10,
  },

  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },

  label: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },

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
  pillActive:     { backgroundColor: '#4f46e5', borderColor: '#6366f1' },
  pillText:       { fontSize: 13, color: '#94a3b8' },
  pillTextActive: { color: '#fff', fontWeight: '600' },

  actionBtn: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnText: { color: '#e2e8f0', fontWeight: '600' },

  statusOk:    { color: '#22c55e', fontSize: 13 },
  statusError: { color: '#ef4444', fontSize: 13 },

  // Whisper model rows
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modelRowActive: { borderColor: '#4f46e5' },
  modelInfo:      { flex: 1 },
  modelName:      { fontSize: 14, color: '#94a3b8' },
  modelNameActive:{ color: '#a5b4fc', fontWeight: '600' },

  modelActions: { flexDirection: 'row', gap: 8 },

  smallBtn: {
    backgroundColor: '#312e81',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 70,
    alignItems: 'center',
  },
  smallBtnDisabled: { opacity: 0.5 },
  smallBtnText: { color: '#a5b4fc', fontSize: 13, fontWeight: '600' },

  smallBtnDanger: {
    backgroundColor: '#1c1917',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#292524',
  },
  smallBtnDangerText: { color: '#78716c', fontSize: 13 },

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
