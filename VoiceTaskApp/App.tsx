import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { initDB } from './src/services/db';
import { requestPermissions } from './src/services/notificationService';
import { tryAutoLoad } from './src/services/whisperService';
import { useDraftRetry } from './src/utils/useDraftRetry';
import TabNavigator from './src/navigation/TabNavigator';

function AppRoot() {
  useDraftRetry();
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <TabNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([initDB(), requestPermissions(), tryAutoLoad()])
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to initialize database:{'\n'}{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return <AppRoot />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: { color: '#94a3b8', fontSize: 16 },
  errorText: { color: '#f87171', fontSize: 14, textAlign: 'center' },
});
