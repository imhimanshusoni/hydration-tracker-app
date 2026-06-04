// Step 1 — name. Single text input, Continue disabled until non-empty.

import React from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Fonts } from '../../../fonts';
import type { AppTheme } from '../../../theme';
import { COPY } from '../copy';

interface NameStepProps {
  theme: AppTheme;
  name: string;
  onChangeName: (name: string) => void;
}

export function NameStep({ theme, name, onChangeName }: NameStepProps) {
  return (
    <TextInput
      style={[
        styles.input,
        {
          color: theme.text,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
      ]}
      value={name}
      onChangeText={onChangeName}
      placeholder={COPY.name.placeholder}
      placeholderTextColor={theme.textSecondary}
      textContentType="name"
      autoComplete="name"
      autoCapitalize="words"
      returnKeyType="done"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 20,
    fontFamily: Fonts.medium,
  },
});
