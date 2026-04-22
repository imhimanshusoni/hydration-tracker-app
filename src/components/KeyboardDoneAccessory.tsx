// iOS-only "Done" bar that sits above the number-pad / decimal-pad keyboard
// (which have no built-in Return key). Attach via inputAccessoryViewID on the
// TextInput; render <KeyboardDoneAccessory /> exactly once at the app root
// (App.tsx) so the native InputAccessoryView is registered with iOS before
// any TextInput can be focused — otherwise the first focus on a fresh screen
// races the native mount and renders without the accessory.

import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Fonts } from '../fonts';
import { getTheme } from '../theme';

export const KEYBOARD_ACCESSORY_ID = 'water-reminder-keyboard-done';
// Secondary ID used when two numeric TextInputs sit on the same screen; sharing
// one accessory across them can fail to re-attach on focus change (iOS quirk),
// so each input binds its own InputAccessoryView instance via a distinct ID.
export const KEYBOARD_ACCESSORY_ID_ALT = 'water-reminder-keyboard-done-alt';

interface KeyboardDoneAccessoryProps {
  nativeID?: string;
}

export function KeyboardDoneAccessory({
  nativeID = KEYBOARD_ACCESSORY_ID,
}: KeyboardDoneAccessoryProps = {}) {
  if (Platform.OS !== 'ios') return null;
  const theme = getTheme(null);
  return (
    <InputAccessoryView nativeID={nativeID}>
      <View
        style={[
          styles.bar,
          { backgroundColor: theme.surface, borderTopColor: theme.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => Keyboard.dismiss()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
        >
          <Text style={[styles.doneText, { color: theme.accent }]}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
});
