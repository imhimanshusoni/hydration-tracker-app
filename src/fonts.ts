// Poppins font family constants.
// On Android, fontFamily is the file name without extension.
// On iOS, fontFamily is the PostScript name.
// Poppins uses the same name on both platforms.

import { Platform } from 'react-native';

// On Android, React Native maps fontWeight to the correct file
// only for system fonts. For custom fonts, we must use the exact
// file/PostScript name per weight.
export const Fonts = {
  thin: Platform.select({
    ios: 'Poppins-Thin',
    android: 'Poppins-Thin',
  }) as string,
  light: Platform.select({
    ios: 'Poppins-Light',
    android: 'Poppins-Light',
  }) as string,
  regular: Platform.select({
    ios: 'Poppins-Regular',
    android: 'Poppins-Regular',
  }) as string,
  medium: Platform.select({
    ios: 'Poppins-Medium',
    android: 'Poppins-Medium',
  }) as string,
  semiBold: Platform.select({
    ios: 'Poppins-SemiBold',
    android: 'Poppins-SemiBold',
  }) as string,
  bold: Platform.select({
    ios: 'Poppins-Bold',
    android: 'Poppins-Bold',
  }) as string,
};
