# Dependency health

Audit snapshot: 2026-09-25, Expo SDK 57.

## Remaining advisories

`npm audit` reports 16 moderate package findings. These are propagation through the dependency graph of two transitive advisories; there are no high or critical findings.

### Runtime: malformed URL denial of service

- Advisory: [`GHSA-vcc3-ghjq-m6fr`](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)
- Installed path: `expo-router@57.0.23 > query-string@7.1.3 > decode-uri-component@0.2.2`
- Reported package findings: `decode-uri-component`, `query-string`, and `expo-router`
- Exposure: Expo Router parses URL query parameters through `query-string`, so malformed external/deep-link input can reach the affected decoder.
- Why it remains: `decode-uri-component` is fixed in `0.5.0`, but `query-string@7.1.3` declares `^0.2.2`. The current SDK-57 release of `expo-router` still declares `query-string@^7.1.3`. A fixed `query-string` release is ESM and outside that declared major-version range. Overriding either package would therefore bypass upstream compatibility constraints and could break Router's CommonJS import or URL semantics. npm's suggested `expo-router@5.1.11` is an SDK-incompatible downgrade, not a safe fix.
- Resolution: wait for an Expo SDK-57-compatible `expo-router` patch that upgrades or replaces `query-string`; do not add an override.

### Build tooling: UUID buffer bounds check

- Advisory: [`GHSA-w5hq-g745-h8pq`](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
- Installed path: Expo SDK packages use `@expo/config-plugins@57.0.9 > xcode@3.0.1 > uuid@7.0.3`.
- Reported package findings: `uuid`, `xcode`, `@expo/config-plugins`, and ten Expo packages that inherit the finding (`@expo/cli`, `@expo/config`, `@expo/inline-modules`, `@expo/local-build-cache-provider`, `@expo/metro-config`, `@expo/prebuild-config`, `expo`, `expo-sharing`, `expo-splash-screen`, and `@react-native-community/datetimepicker`).
- Exposure: this chain runs in Node-based native project/config generation and is not shipped in the application runtime. The advisory affects UUID v3/v5/v6 with a caller-provided buffer; `xcode@3.0.1` calls only `uuid.v4()` without a buffer, so the vulnerable operation is not reachable through this dependency path.
- Why it remains: the fix requires `uuid>=11.1.1`, while the latest stable `xcode@3.0.1` declares `uuid@^7.0.3`. The current `@expo/config-plugins@57.0.9` is the SDK-compatible release and still declares `xcode@^3.0.1`. Forcing UUID across four major versions, or accepting npm's proposed Expo downgrades, would violate upstream constraints without reducing a reachable runtime risk.
- Resolution: wait for `xcode` and Expo config-plugin updates; do not add an override.

Re-run `npm audit` and this compatibility assessment whenever Expo SDK-57 patches are updated.
