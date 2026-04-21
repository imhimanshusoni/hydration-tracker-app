# Releasing Water Reminder

One-time setup + repeatable release steps for the Play Store. Tracks the plan at `~/.claude/plans/breezy-kindling-gray.md`.

## One-time setup

### 1. Generate a release keystore

Outside the repo. Back up in at least two places — loss = permanent inability to update without Play Console key reset.

```bash
mkdir -p ~/keystores
keytool -genkeypair -v \
  -keystore ~/keystores/waterreminder-release.jks \
  -alias waterreminder \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```

The `keytool` prompts ask for:

- **Keystore password** — use a strong password; store in your password manager.
- **Key password** — same or different; either is fine.
- Name / org / city / state / country — any reasonable values. Users never see these.

### 2. Create `android/keystore.properties`

This file is gitignored. Fill with the values you just used:

```
storeFile=/Users/YOUR_HOME/keystores/waterreminder-release.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=waterreminder
keyPassword=YOUR_KEY_PASSWORD
```

Use the absolute path — relative paths resolve against `android/` and break.

### 3. Verify the wiring

```bash
cd android && ./gradlew signingReport
```

Look for the `release` variant. The SHA1 and SHA-256 fingerprints should come from your new keystore, not the debug one. Copy these fingerprints — you'll paste them into Play Console later.

### 4. Enroll in Google Play App Signing

In Play Console, create the app listing and enroll in Play App Signing. Upload `~/keystores/waterreminder-release.jks` as your **upload key**. Google generates and holds the actual app-signing key. This means if you ever lose your upload key, Google can reset it — much safer than managing the app-signing key yourself.

## Per-release steps

Repeat each release.

### 1. Verify tests + types + tree

```bash
npx tsc --noEmit
npm test
git status                      # must be clean
```

### 2. Verify `.env` has real values

Not committed; check manually:

- `MIXPANEL_TOKEN=<your real token>`
- `MIXPANEL_SERVER_URL=https://api-eu.mixpanel.com` (EU project) — leave empty for US
- `OPENWEATHERMAP_API_KEY=<your real key>`

### 3. Build the AAB

```bash
npm run android:release
```

Artifact: `android/app/build/outputs/bundle/release/app-release.aab` (typically 50–80 MB with Hermes).

### 4. Sanity-check the AAB

```bash
# Verify it's signed
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab | head -5

# Confirm version
bundletool dump manifest --bundle=android/app/build/outputs/bundle/release/app-release.aab \
  | grep -E "versionCode|versionName"
```

(`bundletool` is optional; Play Console will verify on upload.)

### 5. Upload to Internal testing

1. Play Console → your app → Testing → Internal testing → Create new release.
2. Upload the AAB.
3. Release notes: paste the tag body from `git tag -n99 v1.4.0`.
4. Save & review → Start rollout to internal testing.
5. Add your Google account(s) to the tester list.

Wait ~15 min; install via the opt-in link on a real device.

### 6. Smoke test (24h on internal testing)

Follow the Phase 7 checklist in the release plan. Must verify:

- Mixpanel events land in Live View (eu.mixpanel.com)
- Background reminder delivery emits `Reminder Delivered` but NOT `App Opened`
- Live streak counter ticks up at 80% consumption
- No crashes

### 7. Promote to Production

Play Console → Internal testing → Promote release → Production.

Use **staged rollout: 10% → 50% → 100%** over 3 days. Monitor Play Console → Quality → Android vitals. If crash-free user rate drops below 99.5%, halt the rollout and investigate.
