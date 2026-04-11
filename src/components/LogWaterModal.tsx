// Premium bottom-sheet modal for logging water intake.
// Frosted glass surface on deep navy overlay.
// Preset quick-log buttons + custom input with range clamping.

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

interface LogWaterModalProps {
  visible: boolean;
  onClose: () => void;
  onLog: (amount: number) => void;
  theme: AppTheme;
}

const PRESETS = [
  { ml: 150, label: '150', icon: '💧' },
  { ml: 250, label: '250', icon: '🥤' },
  { ml: 500, label: '500', icon: '🫗' },
];
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

  function handleSliderText(text: string) {
    setCustomText(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(MIN_CUSTOM, Math.min(MAX_CUSTOM, parsed));
      setCustomAmount(clamped);
    }
  }

  function handleTextBlur() {
    setCustomText(String(customAmount));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdropTap} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Drag handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <Text style={[styles.title, { color: theme.text }]}>Log Water</Text>

          {/* Preset buttons */}
          <View style={styles.presetRow}>
            {PRESETS.map(({ ml, label, icon }) => (
              <TouchableOpacity
                key={ml}
                style={[styles.presetButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => handlePreset(ml)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetIcon}>{icon}</Text>
                <Text style={[styles.presetAmount, { color: theme.text }]}>{label}</Text>
                <Text style={[styles.presetUnit, { color: theme.textSecondary }]}>ml</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom amount */}
          <View style={[styles.customSection, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.customLabel, { color: theme.textSecondary }]}>Custom amount</Text>
            <View style={styles.customInputRow}>
              <TextInput
                style={[styles.customInput, { color: theme.text }]}
                keyboardType="numeric"
                value={customText}
                onChangeText={handleSliderText}
                onBlur={handleTextBlur}
                maxLength={4}
                placeholderTextColor={theme.textSecondary}
              />
              <Text style={[styles.mlUnit, { color: theme.textSecondary }]}>ml</Text>
            </View>
            <View style={styles.rangeRow}>
              <Text style={[styles.rangeText, { color: theme.textSecondary }]}>{MIN_CUSTOM}</Text>
              <View style={[styles.rangeLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.rangeText, { color: theme.textSecondary }]}>{MAX_CUSTOM}</Text>
            </View>
          </View>

          {/* Log button */}
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
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5, 8, 18, 0.7)',
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 24,
    paddingBottom: 44,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 24,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  presetButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  presetIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  presetAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  presetUnit: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  customSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  customLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  customInput: {
    fontSize: 32,
    fontWeight: '200',
    minWidth: 80,
  },
  mlUnit: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rangeLine: {
    flex: 1,
    height: 1,
  },
  rangeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  logButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  logButtonText: {
    color: '#0A0F1E',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
