// Bottom-sheet modal for logging water.
// Clean numeric presets (no emoji), custom input with range.

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import type { AppTheme } from '../theme';
import { Fonts } from '../fonts';

interface LogWaterModalProps {
  visible: boolean;
  onClose: () => void;
  onLog: (amount: number) => void;
  theme: AppTheme;
}

const PRESETS = [150, 250, 500];
const MIN_CUSTOM = 50;
const MAX_CUSTOM = 1000;

export function LogWaterModal({ visible, onClose, onLog, theme }: LogWaterModalProps) {
  const [customAmount, setCustomAmount] = useState(250);
  const [customText, setCustomText] = useState('250');

  function handlePreset(amount: number) {
    onLog(amount);
    onClose();
  }

  function handleCustomLog() {
    onLog(customAmount);
    onClose();
  }

  function handleTextChange(text: string) {
    setCustomText(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed)) {
      setCustomAmount(Math.max(MIN_CUSTOM, Math.min(MAX_CUSTOM, parsed)));
    }
  }

  function handleTextBlur() {
    setCustomText(String(customAmount));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <Text style={[styles.title, { color: theme.text }]}>Log Water</Text>

          {/* Presets — clean numeric buttons */}
          <View style={styles.presetRow}>
            {PRESETS.map((ml) => (
              <TouchableOpacity
                key={ml}
                style={[styles.presetButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => handlePreset(ml)}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetValue, { color: theme.text }]}>{ml}</Text>
                <Text style={[styles.presetUnit, { color: theme.textSecondary }]}>ml</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom input */}
          <View style={[styles.customCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.customLabel, { color: theme.textSecondary }]}>Custom amount</Text>
            <View style={styles.customInputRow}>
              <TextInput
                style={[styles.customInput, { color: theme.text }]}
                keyboardType="numeric"
                value={customText}
                onChangeText={handleTextChange}
                onBlur={handleTextBlur}
                maxLength={4}
                placeholderTextColor={theme.textSecondary}
              />
              <Text style={[styles.customUnit, { color: theme.textSecondary }]}>ml</Text>
            </View>
            <View style={styles.rangeRow}>
              <Text style={[styles.rangeText, { color: theme.textSecondary }]}>{MIN_CUSTOM}</Text>
              <View style={[styles.rangeLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.rangeText, { color: theme.textSecondary }]}>{MAX_CUSTOM}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.logButton, { backgroundColor: theme.accent }]}
            onPress={handleCustomLog}
            activeOpacity={0.8}
          >
            <Text style={styles.logButtonText}>Log {customAmount} ml</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.6}>
            <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3, 5, 12, 0.75)' },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 24,
    paddingBottom: 44,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontFamily: Fonts.semiBold, marginBottom: 24 },

  presetRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  presetButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  presetValue: { fontSize: 22, fontFamily: Fonts.semiBold },
  presetUnit: { fontSize: 12, fontFamily: Fonts.regular, marginTop: 2 },

  customCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 20 },
  customLabel: { fontSize: 12, fontFamily: Fonts.semiBold, letterSpacing: 0.3, marginBottom: 8 },
  customInputRow: { flexDirection: 'row', alignItems: 'baseline' },
  customInput: { fontSize: 32, fontFamily: Fonts.light, minWidth: 80 },
  customUnit: { fontSize: 16, fontFamily: Fonts.regular, marginLeft: 4 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  rangeLine: { flex: 1, height: 1 },
  rangeText: { fontSize: 11, fontFamily: Fonts.regular },

  logButton: { paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  logButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: Fonts.bold },
  cancelButton: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 15, fontFamily: Fonts.medium },
});
