// Step 2 — body basics: weight, age, gender. Stacked full-width with
// generous spacing so each sub-question reads as its own line.
// Two numeric inputs share this screen, so they use the two distinct
// keyboard accessory IDs (iOS re-attach quirk, see KeyboardDoneAccessory).

import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Fonts } from '../../../fonts';
import type { AppTheme } from '../../../theme';
import type { Gender } from '../../../types';
import {
  KEYBOARD_ACCESSORY_ID,
  KEYBOARD_ACCESSORY_ID_ALT,
} from '../../../components/KeyboardDoneAccessory';
import { COPY } from '../copy';

interface BodyStepProps {
  theme: AppTheme;
  weightText: string;
  onChangeWeight: (text: string) => void;
  weightError: string | null;
  ageText: string;
  onChangeAge: (text: string) => void;
  ageError: string | null;
  gender: Gender | null;
  onChangeGender: (gender: Gender) => void;
}

export function BodyStep({
  theme,
  weightText,
  onChangeWeight,
  weightError,
  ageText,
  onChangeAge,
  ageError,
  gender,
  onChangeGender,
}: BodyStepProps) {
  return (
    <View style={styles.stack}>
      {/* Weight */}
      <View>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          {COPY.body.weightLabel}
        </Text>
        <View
          style={[
            styles.inputRow,
            {
              borderColor: weightError ? theme.error : theme.border,
              backgroundColor: theme.surface,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={weightText}
            onChangeText={onChangeWeight}
            placeholder={COPY.body.weightPlaceholder}
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
            maxLength={3}
          />
          <Text style={[styles.unit, { color: theme.textSecondary }]}>
            {COPY.body.weightUnit}
          </Text>
        </View>
        {weightError && (
          <Text style={[styles.errorText, { color: theme.error }]}>
            {weightError}
          </Text>
        )}
      </View>

      {/* Age */}
      <View>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          {COPY.body.ageLabel}
        </Text>
        <View
          style={[
            styles.inputRow,
            {
              borderColor: ageError ? theme.error : theme.border,
              backgroundColor: theme.surface,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={ageText}
            onChangeText={onChangeAge}
            placeholder={COPY.body.agePlaceholder}
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            inputAccessoryViewID={KEYBOARD_ACCESSORY_ID_ALT}
            maxLength={3}
          />
        </View>
        {ageError && (
          <Text style={[styles.errorText, { color: theme.error }]}>
            {ageError}
          </Text>
        )}
      </View>

      {/* Gender */}
      <View>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
          {COPY.body.genderLabel}
        </Text>
        <View style={styles.pillRow}>
          {(['male', 'female', 'other'] as const).map((g) => {
            const selected = gender === g;
            return (
              <TouchableOpacity
                key={g}
                style={[
                  styles.pill,
                  {
                    backgroundColor: selected ? theme.accent : theme.surface,
                    borderColor: selected ? theme.accent : theme.border,
                  },
                ]}
                onPress={() => onChangeGender(g)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: selected ? '#FFFFFF' : theme.text },
                  ]}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 24 },

  fieldLabel: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontFamily: Fonts.medium,
    paddingVertical: 13,
  },
  unit: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    marginTop: 6,
  },

  pillRow: { flexDirection: 'row', gap: 10 },
  pill: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
});
