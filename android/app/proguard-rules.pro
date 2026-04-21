# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# --- Mixpanel Analytics (mixpanel-react-native 3.x + Mixpanel-swift/android 5.x) ---
# The SDK uses reflection for Java↔native bridging; without keep rules,
# minified release builds silently drop events.
-keep class com.mixpanel.** { *; }
-dontwarn com.mixpanel.**

# --- Notifee (@notifee/react-native) ---
# Library ships consumer proguard rules, these are belt-and-suspenders.
-keep class io.invertase.notifee.** { *; }
-dontwarn io.invertase.notifee.**

# --- Hermes (React Native JS engine) ---
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
