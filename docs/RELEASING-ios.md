# Releasing Water Reminder — iOS

One-time setup + repeatable release steps for the App Store. Sister doc to `RELEASING.md` (Android / Play Store).

## One-time setup

### 1. Apple Developer Program

You need an active Apple Developer Program membership ($99/yr) under team ID `2TJ9K965G7` (already wired into `ios/WaterReminder.xcodeproj/project.pbxproj` and `ios/ExportOptions.plist`). If the team ID changes, update both files.

### 2. Register the App ID

Apple Developer portal → Certificates, Identifiers & Profiles → Identifiers → `+`.

- **Type:** App IDs → App
- **Description:** Water Reminder
- **Bundle ID (explicit):** `in.habuild.waterreminder`
- **Capabilities — enable:**
  - HealthKit
  - Time Sensitive Notifications

The bundle ID must match `PRODUCT_BUNDLE_IDENTIFIER` in `project.pbxproj`. The two capabilities must match `ios/WaterReminder/WaterReminder.entitlements`. Mismatches cause "missing entitlement" errors at archive time.

### 3. Provisioning + signing

Easiest path: leave Xcode in **Automatic signing** (already the default).

1. Open `ios/WaterReminder.xcworkspace` in Xcode.
2. Project navigator → WaterReminder target → Signing & Capabilities tab.
3. Confirm: **Automatically manage signing** ✓, Team: habuild, Bundle ID: `in.habuild.waterreminder`.
4. Xcode will fetch / create a Distribution certificate and an App Store provisioning profile on first archive.

Manual signing is only worth setting up if you want to build on CI without an Apple ID interactive login. Skip until that is needed.

### 4. Create the App Store Connect entry

App Store Connect → My Apps → `+` → New App.

- **Platform:** iOS
- **Name:** Water Reminder
- **Primary language:** English (U.S.)
- **Bundle ID:** `in.habuild.waterreminder` (the App ID you registered above appears in the dropdown)
- **SKU:** `waterreminder-ios` (any unique string; not user-visible)
- **Full access** (not limited)

### 5. Fill in App Information

App Store Connect → your app → App Information.

- **Category — primary:** Health & Fitness (matches `LSApplicationCategoryType = public.app-category.healthcare-fitness`)
- **Category — secondary:** Lifestyle (optional)
- **Content rights:** Does not contain third-party content
- **Age rating:** complete questionnaire — none of the categories apply → expect 4+
- **Privacy Policy URL:** `https://habuild.in/water-reminder/privacy-policy/` (publish `docs/privacy-policy.md` first if not live yet)

### 6. Fill in App Privacy (Data Collection)

App Store Connect → your app → App Privacy. Apple requires declaring everything sent off-device. Source of truth: `docs/privacy-policy.md`.

Declare these data types as **collected and linked to user**, used for **Analytics**:

| Category | Data type | Notes |
|----------|-----------|-------|
| Contact Info | Name | Display name → Mixpanel `$name` |
| Health & Fitness | Health | Hydration logs, daily goal |
| Health & Fitness | Fitness | Active minutes (aggregate only) |
| Identifiers | User ID | Anonymous Mixpanel distinct ID |
| Usage Data | Product Interaction | Screen views, taps, log events |
| Usage Data | Other Usage Data | Install date, app version, platform |
| Other Data | Other Data | Age, weight, gender, climate, schedule (profile fields) |

For each: **Used for Analytics**, **Linked to user**, **Not used for tracking**.

Tracking is **OFF** (matches `NSPrivacyTracking` = false in `PrivacyInfo.xcprivacy`).

### 7. Encryption / export compliance

App Uses Non-Exempt Encryption: **No** (HTTPS only, no proprietary crypto).

You can pre-declare this once in App Store Connect → App Information → "App Uses Non-Exempt Encryption" so that you don't get prompted at every TestFlight upload.

### 8. TestFlight

App Store Connect → your app → TestFlight → Internal Testing.

- Create an internal testing group ("Internal").
- Add yourself by Apple ID; test users get an email + the TestFlight app link.

## Per-release steps

Repeat every release.

### 1. Verify tests + types + tree

```bash
npx tsc --noEmit
npm test
git status                      # must be clean
```

### 2. Verify `.env` has real values

Same checks as Android (see `docs/RELEASING.md` step 2).

### 3. Bump version

Two numbers in `ios/WaterReminder.xcodeproj/project.pbxproj`:

- `MARKETING_VERSION` → user-visible version string (e.g. `1.4.0`). Keep in sync with `package.json` `version` and Android `versionName`.
- `CURRENT_PROJECT_VERSION` → build number. Apple requires this to **strictly increase** for every TestFlight upload, even within the same `MARKETING_VERSION`. Bump per upload.

Both keys appear twice (Debug + Release configs); change both.

### 4. Pod install (if dependencies changed)

```bash
cd ios && pod install && cd ..
```

Skip if `Podfile.lock` hasn't changed since last release.

### 5. Build the archive

```bash
npm run ios:archive
```

Output: `ios/build/WaterReminder.xcarchive` (~150–250 MB).

The script runs `xcodebuild ... archive` against `WaterReminder.xcworkspace` (Release config, `generic/platform=iOS`). First run triggers Xcode to fetch a Distribution certificate + provisioning profile; you may get a keychain prompt to allow `codesign` to sign with your private key.

### 6. Export the .ipa

```bash
npm run ios:export
```

Output: `ios/build/ipa/WaterReminder.ipa` (~20–40 MB).

Reads `ios/ExportOptions.plist` for method (`app-store-connect`) and team (`2TJ9K965G7`).

(`ios:release` runs both 5 + 6 in sequence.)

### 7. Upload to App Store Connect

Two options — pick one.

**Option A — Transporter (GUI, easiest):**
Open the Transporter app (free on Mac App Store) → drag in `ios/build/ipa/WaterReminder.ipa` → Deliver. Wait for "Delivered" + then ~5–15 min for processing.

**Option B — Xcode Organizer:**
Skip the export step. Window → Organizer → select the archive → Distribute App → App Store Connect → Upload. Xcode handles signing + upload in one flow.

**Option C — `xcrun altool` (CLI):**
Requires an [App-Specific Password](https://appleid.apple.com) or App Store Connect API key. Useful for CI; overkill for manual releases.

### 8. TestFlight smoke test

App Store Connect → your app → TestFlight → Builds. Wait for the build to finish processing (status changes from "Processing" to a build number). Then:

1. Add the build to the Internal testing group.
2. Install via the TestFlight app on a real device.
3. Run the same smoke checklist as the Android release plan: log a drink, hit the goal, verify Mixpanel Live View receives events from the iOS build (`platform: ios`), let an hourly reminder fire and confirm `Reminder Delivered` lands without `App Opened`.

If anything is broken, fix → bump `CURRENT_PROJECT_VERSION` → re-archive → re-upload.

### 9. Submit for App Review

App Store Connect → your app → App Store tab → `+` → iOS → version number.

Fill in:

- **What's new in this version:** paste the tag body, same as Play Store release notes.
- **Promotional text** (optional, 170 chars).
- **Build:** select the TestFlight build you smoke-tested.
- **App Review Information:**
  - Sign-in required: **No**
  - Notes: brief one-liner. Example: *"Hydration tracker. HealthKit permission is optional and only used to read active minutes (HKQuantityTypeIdentifierAppleExerciseTime) to bump the daily water goal. Location is optional and only used to fetch local weather (one-time-per-recalculation) for the same purpose. App functions fully without either permission."*
- **Version Release:**
  - **Manual release** (recommended for first release — let App Review approve it, then you choose when to ship).
  - For later releases: **Phased Release for Automatic Updates** — Apple ramps to 100% over 7 days. Equivalent to Play Store staged rollout.

Submit for review. First review typically takes 24–48h. Subsequent reviews are usually < 24h.

### 10. Release

Once approved:

- **Manual release:** App Store Connect → your app → click "Release this Version".
- **Phased release:** ramps automatically. Monitor App Store Connect → Analytics → Crashes daily. If crash rate spikes, App Store Connect → your app → "Pause Phased Release".

## Troubleshooting

- **"Missing Time Sensitive Notifications entitlement" at archive time** — App ID in Apple Developer portal doesn't have the capability enabled. Re-check step 2.
- **"No matching provisioning profile"** — Open Xcode → Signing & Capabilities → uncheck and re-check "Automatically manage signing" to force a refetch.
- **TestFlight stuck in "Processing"** — usually < 30 min. If > 2h, check App Store Connect → your app → Activity for ITMS-90xxx warnings (often missing privacy strings or invalid bundle).
- **`xcodebuild` fails with `"WaterReminder.xcworkspace" does not exist`** — run `cd ios && pod install && cd ..` first; the workspace is generated by CocoaPods.
- **Notification sound silent on iOS** — `water_drop.wav` is bundled (see `assets/sounds/water_drop.wav` referenced in `project.pbxproj`); confirm the `ios:` block in `notificationScheduler.ts` references `'water_drop.wav'` exactly (case + extension).
