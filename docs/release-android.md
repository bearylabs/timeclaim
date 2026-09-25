# Android release

TimeClaim uses EAS Build. The Android application ID is `de.timeclaim.app`.

## Build profiles

| Profile | Artifact | Purpose |
| --- | --- | --- |
| `development` | APK with Expo development client | Development devices |
| `preview` | Standalone APK | Sideloaded private beta |
| `production` | AAB | Google Play |

Run the local checks before requesting a remote build:

```sh
npm ci
npm run doctor
npm run lint
npm run typecheck
npm run export:android
```

The build commands are intentionally separate because they use the remote EAS service and require an Expo account and Android signing credentials:

```sh
npm run build:android:development
npm run build:android:preview
npm run build:android:production
```

EAS manages the Android `versionCode` remotely and increments it for every production build. Before a public release, update the user-visible semantic `version` in both `app.json` and `package.json` (and refresh `package-lock.json` with `npm install --package-lock-only`). Keep those two versions equal. Commit the version change before building; EAS rejects builds from an uncommitted worktree.

## First-time setup and Play release

1. Sign in with `eas login`, then run `eas init` to link the project. Commit only the generated EAS project ID; never commit tokens, keystores, service-account JSON, or other credentials.
2. Let EAS create/manage an Android keystore on the first authenticated build, or supply the team's existing upload key. Store recovery material outside this repository.
3. Install and test the `preview` APK on representative supported devices, including backup/restore and date/time entry.
4. Build the production AAB. Upload it manually to Play Console, or configure EAS Submit credentials outside Git and submit with `eas submit --platform android --profile production`. The submit profile targets Play's **internal** track; promote the tested release in Play Console.
5. Complete Play Console requirements: store listing and screenshots, privacy-policy URL, data-safety declaration, content rating, app access, target audience, contact details, and internal-test testers.
6. Verify Play App Signing/upload-key ownership and archive the release notes and tested commit.

## Branding

The configured icon, adaptive icon, monochrome icon, favicon, and splash use the TimeClaim clock/check mark. Editable SVG sources live in `assets/branding/`; generated PNGs preserve Expo's icon dimensions, adaptive-icon safe zone, and transparency requirements. Review the rendered icon and splash on a physical device before a public store release.
