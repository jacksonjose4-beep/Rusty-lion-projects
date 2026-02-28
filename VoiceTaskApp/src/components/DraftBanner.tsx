import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useDraftsStore } from '../store/useDraftsStore';

interface Props {
  onPress?: () => void;
}

export default function DraftBanner({ onPress }: Props) {
  const draftCount = useDraftsStore((s) => s.draftCount);

  if (draftCount === 0) return null;

  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.dot} />
      <Text style={styles.text}>
        {draftCount} voice {draftCount === 1 ? 'note' : 'notes'} waiting to parse
      </Text>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#312e81',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#818cf8',
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#a5b4fc',
    fontWeight: '500',
  },
  arrow: {
    fontSize: 18,
    color: '#818cf8',
  },
});
