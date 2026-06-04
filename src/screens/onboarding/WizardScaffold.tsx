// Shared layout for onboarding wizard steps: progress bar, question heading,
// helper copy, scrollable body, and a sticky Back/Continue footer.
// The footer hides while the keyboard is open (the Done accessory becomes
// the only element above the keyboard), matching the pre-wizard behavior.

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '../../fonts';
import type { AppTheme } from '../../theme';
import { COPY } from './copy';
import { ProgressBar } from './ProgressBar';

interface WizardScaffoldProps {
  theme: AppTheme;
  stepIndex: number;
  totalSteps: number;
  heading: string;
  helper: string;
  children: React.ReactNode;
  onBack?: () => void;
  onContinue: () => void;
  continueDisabled: boolean;
  hideFooter?: boolean;
}

export function WizardScaffold({
  theme,
  stepIndex,
  totalSteps,
  heading,
  helper,
  children,
  onBack,
  onContinue,
  continueDisabled,
  hideFooter,
}: WizardScaffoldProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.background, paddingTop: insets.top },
      ]}
    >
      <ProgressBar current={stepIndex} total={totalSteps} theme={theme} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: theme.text }]}>{heading}</Text>
        <Text style={[styles.helper, { color: theme.textSecondary }]}>
          {helper}
        </Text>
        {children}
      </ScrollView>

      {!hideFooter && (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.border,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          {onBack ? (
            <TouchableOpacity
              style={[styles.backButton, { borderColor: theme.border }]}
              onPress={onBack}
              activeOpacity={0.7}
            >
              <Text style={[styles.backText, { color: theme.textSecondary }]}>
                {COPY.back}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                backgroundColor: continueDisabled ? theme.surface : theme.accent,
                borderColor: continueDisabled ? theme.border : theme.accent,
              },
            ]}
            onPress={onContinue}
            disabled={continueDisabled}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.continueText,
                { color: continueDisabled ? theme.textSecondary : '#FFFFFF' },
              ]}
            >
              {COPY.continue}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },

  // 35+ type spec: large question, readable helper.
  heading: {
    fontSize: 27,
    fontFamily: Fonts.semiBold,
    letterSpacing: -0.3,
    marginTop: 28,
  },
  helper: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    letterSpacing: 0.1,
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 23,
  },

  footer: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  backButton: {
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
  },
  continueButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.2,
  },
});
