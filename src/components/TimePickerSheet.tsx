// Bottom-sheet time picker. Mirrors LogWaterModal's sheet pattern.
// Wraps @react-native-community/datetimepicker in a themed modal
// with draft state, so callers only receive the value on Done.

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import type { AppTheme } from '../theme';
import { Fonts } from '../fonts';
import type { TimeOfDay } from '../types';

interface TimePickerSheetProps {
  visible: boolean;
  title: string;
  value: TimeOfDay;
  onClose: () => void;
  onConfirm: (value: TimeOfDay) => void;
  theme: AppTheme;
}

function makeDate(t: TimeOfDay): Date {
  const d = new Date();
  d.setHours(t.hour, t.minute, 0, 0);
  return d;
}

export function TimePickerSheet({
  visible,
  title,
  value,
  onClose,
  onConfirm,
  theme,
}: TimePickerSheetProps) {
  const [draft, setDraft] = useState<TimeOfDay>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  function handleChange(_event: DateTimePickerEvent, date?: Date) {
    if (date) {
      setDraft({ hour: date.getHours(), minute: date.getMinutes() });
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={makeDate(draft)}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleChange}
              textColor={theme.text}
              themeVariant="dark"
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { borderColor: theme.border, backgroundColor: theme.background },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: theme.accent }]}
              onPress={() => onConfirm(draft)}
              activeOpacity={0.8}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(3, 5, 12, 0.75)',
  },
  backdrop: { flex: 1 },
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
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
    marginBottom: 8,
  },
  pickerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  footer: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontFamily: Fonts.medium },
  doneButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.bold },
});
