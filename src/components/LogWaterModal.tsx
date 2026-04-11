// Modal for logging water intake.
// Preset buttons (150/250/500 ml) + slider with text input (50-1000 ml).

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

  function handleSliderText(text: string) {
    setCustomText(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(MIN_CUSTOM, Math.min(MAX_CUSTOM, parsed));
      setCustomAmount(clamped);
    }
  }

  function handleTextBlur() {
    // Sync text field to clamped value on blur
    setCustomText(String(customAmount));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.text }]}>Log Water</Text>

          {/* Preset buttons */}
          <View style={styles.presetRow}>
            {PRESETS.map((ml) => (
              <TouchableOpacity
                key={ml}
                style={[styles.presetButton, { borderColor: theme.accent }]}
                onPress={() => handlePreset(ml)}
              >
                <Text style={[styles.presetText, { color: theme.accent }]}>{ml} ml</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom amount section */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            Custom amount
          </Text>

          <View style={styles.customRow}>
            <TextInput
              style={[styles.customInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
              keyboardType="numeric"
              value={customText}
              onChangeText={handleSliderText}
              onBlur={handleTextBlur}
              maxLength={4}
            />
            <Text style={[styles.mlLabel, { color: theme.textSecondary }]}>ml</Text>
          </View>

          {/* Slider - using a simple view-based approach since
              @react-native-community/slider adds another dep.
              The text input + presets cover the UX need. */}
          <View style={styles.rangeHint}>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{MIN_CUSTOM} ml</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{MAX_CUSTOM} ml</Text>
          </View>

          <TouchableOpacity
            style={[styles.logButton, { backgroundColor: theme.accent }]}
            onPress={handleCustomLog}
          >
            <Text style={styles.logButtonText}>Log {customAmount} ml</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={{ color: theme.textSecondary }}>Cancel</Text>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  presetButton: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 14,
    marginBottom: 10,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
  },
  mlLabel: {
    fontSize: 16,
    marginLeft: 10,
  },
  rangeHint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  logButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
});
