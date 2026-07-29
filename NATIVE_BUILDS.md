# AfriSell Native Builds

AfriSell utilise Tauri v2 pour emballer l'application React/Vite en applications natives macOS, Android et iOS.

## Scripts

```bash
npm run tauri:dev
npm run tauri:build:macos
npm run tauri:android:init
npm run tauri:android:apk
npm run tauri:android:all
npm run tauri:ios:init
npm run tauri:ios:ipa
```

## Auth Google Android

L'APK utilise un flux Google natif Android. Il ne passe pas par `signInWithPopup` ou `signInWithRedirect`.

Avant de compiler l'APK avec Google actif, ajoute dans `.env.local`:

```env
VITE_GOOGLE_WEB_CLIENT_ID="TON_WEB_CLIENT_ID_FIREBASE.apps.googleusercontent.com"
```

Ce client ID se trouve dans Firebase Console, Project settings, General, Web client ID.

## Artefacts générés localement

macOS:

```text
src-tauri/target/release/bundle/macos/AfriSell.app
src-tauri/target/release/bundle/dmg/AfriSell_0.1.0_x64.dmg
```

Android:

```text
src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab
```

L'APK release est signé si `src-tauri/gen/android/keystore.properties` existe. Ce fichier et la keystore locale ne doivent pas être poussés sur Git.

Signature locale actuelle:

```text
Alias: afrissel
Certificate SHA-256: 62a904d6c6438e0bb6e053eaca8947bd82e3b696d7ba459634bbdc28b97c104c
```

## iOS

La cible iOS est prévue par les scripts Tauri, mais elle exige une machine compatible avec Xcode complet, `xcodegen`, CocoaPods et une équipe Apple Developer configurée.

Sur cette machine, l'initialisation iOS bloque parce que macOS 12 ne permet pas d'installer Xcode 15.3 via Homebrew pour `xcodegen`.

## Sources officielles

- Tauri prerequisites: https://v2.tauri.app/start/prerequisites/
- Tauri mobile: https://v2.tauri.app/start/
- Tauri CLI mobile commands: `npx tauri android --help` et `npx tauri ios --help`
