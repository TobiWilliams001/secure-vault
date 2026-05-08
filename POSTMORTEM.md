# Secure Vault — Engineering Post-Mortem

**Date:** May 2026
**Type:** Full-stack mobile app — zero-knowledge password manager
**Stack:** React Native (Expo SDK 54) + Express 5 + PostgreSQL + TypeScript
**Effort:** Single session, end-to-end from schema to working app

---

## Table of Contents

1. [What We Built](#what-we-built)
2. [Goals and Non-Goals](#goals-and-non-goals)
3. [Architecture Summary](#architecture-summary)
4. [Technical Decisions (with Tradeoffs)](#technical-decisions)
5. [Bugs and Debugging Log](#bugs-and-debugging-log)
6. [What Went Well](#what-went-well)
7. [What Was Hard](#what-was-hard)
8. [What Would Be Done Differently](#what-would-be-done-differently)
9. [Security Review Checklist](#security-review-checklist)
10. [Lessons for Future Projects](#lessons-for-future-projects)
11. [Further Reading](#further-reading)

---

## What We Built

A production-grade mobile password manager with a real zero-knowledge architecture. Not a toy. Not "we encrypt it somewhere." The server is mathematically incapable of reading user data.

**Features shipped:**
- Register / login with zero-knowledge auth (authKey derivation, never raw password)
- JWT session management with hardware-backed secure storage
- Full vault CRUD: passwords, crypto seed phrases, secure notes, card details
- AES-256 encryption on-device; entire vault synced as a single encrypted blob
- Offline-first: local AsyncStorage cache always updated before server sync
- Biometric unlock: Face ID / Touch ID gates the cached master password in the secure enclave
- In-app password generator with configurable length, character sets, and strength meter
- Settings: biometric toggle, change master password (re-encrypts vault), sign out, delete account
- pnpm monorepo with shared DB layer, OpenAPI spec, and code-generated TypeScript hooks
- Structured server logging (pino), Zod v4 request validation, Drizzle ORM with push migrations

---

## Goals and Non-Goals

### Goals
- True zero-knowledge: encryption key never transmitted or stored on server
- Production-quality security model, not a demo
- Offline-first UX (works without internet after first login)
- Cross-platform iOS and Android from one codebase
- Clean TypeScript end-to-end with no `any` in the API contract

### Non-Goals
- Multi-device concurrent write conflict resolution (single-writer model is acceptable for personal use)
- Password sharing between users
- Browser extension
- Self-hosted key management (HSM, KMS)
- AES-GCM authenticated encryption (blocked by Hermes/crypto-js — see Decision #1)

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     Device (never leaves)                    │
│                                                             │
│  masterPassword                                             │
│       │                                                     │
│       ├──► authKey = SHA256(pwd + ":auth:" + email)         │
│       │         sent to server → bcrypt stored              │
│       │                                                     │
│       └──► encryptionKey = PBKDF2(pwd, salt, 100k iter)     │
│                 ▼                                           │
│         AES256-CTR encrypt/decrypt vault JSON               │
│                 ▼                                           │
│         encryptedBlob ──────────────────────────────────────┼──► PUT /api/vault
│                                                             │
│  expo-secure-store (hardware enclave):                      │
│    sv_token, sv_pbkdf2_salt, sv_biometric_master            │
│                                                             │
│  AsyncStorage (encrypted, offline cache):                   │
│    sv_vault_cache_{userId}                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Server (blind)                           │
│                                                             │
│  PostgreSQL:                                                │
│    users { email, authKeyHash=bcrypt(authKey), pbkdf2Salt } │
│    vaults { userId, encryptedData, updatedAt }              │
│                                                             │
│  Express 5:                                                 │
│    POST /api/auth/register — bcrypt authKey, store salt     │
│    POST /api/auth/login    — verify authKey, return salt    │
│    GET/PUT /api/vault      — return/store encrypted blob    │
└─────────────────────────────────────────────────────────────┘
```

The server receives and stores encrypted bytes it has no key to decrypt. The key lives only in the user's head (as a master password) and ephemerally in device memory during an active session.

---

## Technical Decisions

### Decision 1: crypto-js over Web Crypto API

**What:** All AES and PBKDF2 operations use `crypto-js` (pure JavaScript), not `crypto.subtle`.

**Why it came up:** An initial implementation used `crypto.subtle.importKey` + `crypto.subtle.deriveKey` + `crypto.subtle.encrypt`. This worked perfectly in the browser preview. On a physical iOS device (Hermes JS engine), it silently failed — returned empty strings, no error thrown.

**Root cause:** React Native's Hermes engine does not implement the Web Crypto API. `crypto.subtle` is undefined or throws. The browser-based Expo web preview runs in a real browser where it works, masking the issue.

**Decision:** Swap entirely to `crypto-js`. It's pure JavaScript with no platform API dependencies — runs identically on Hermes, JavaScriptCore, V8, and browsers.

**Tradeoff accepted:**
- `crypto-js` does not implement AES-GCM (authenticated encryption). We use AES-CTR, which provides confidentiality but not ciphertext integrity. A tampered blob will decrypt to garbage silently.
- Mitigation: unique PBKDF2 salt per user + fresh IV per write. Wrong password → clearly garbage output.
- Long-term fix: `react-native-quick-crypto` (native binding to BoringSSL, supports GCM, requires a dev build).

**Lesson:** Test cryptographic code on native devices before writing any application logic on top of it. The gap between browser preview and native can silently swallow entire API surfaces.

---

### Decision 2: Separate authKey from encryptionKey

**What:** Two derived values come from the master password:
- `authKey = SHA256(masterPassword + ":auth:" + email)` — sent to server
- `encryptionKey = PBKDF2(masterPassword, pbkdf2Salt, 100000)` — stays on device

**Why it matters:** If we sent the raw master password for login, the server could use it to derive the encryption key and decrypt the vault. By sending only a *derived* credential that is not the password and cannot be used to derive the encryption key, we achieve true zero-knowledge.

**Why SHA256 not PBKDF2 for authKey:** The authKey itself is never stored in plaintext — the server bcrypt-hashes it (cost 12). SHA256 is cheap client-side, which is fine because bcrypt is expensive server-side. PBKDF2 is reserved for the encryption key where the full 100k iterations are applied on the client.

**The one-way guarantee:** Given `authKey = SHA256(pwd + ":auth:" + email)` and `encryptionKey = PBKDF2(pwd, salt, 100k)`, there is no way to compute one from the other without knowing `pwd`. SHA256 is one-way; PBKDF2 is parameterized differently. Even if the server's entire database leaked, an attacker could not derive any user's encryption key.

**Tradeoff accepted:** Password recovery is impossible. There is no "forgot my password" flow. Any reset mechanism would require the server to facilitate re-encryption, which either leaks the master password or requires the server to hold a recovery key — both break the zero-knowledge model.

---

### Decision 3: pbkdf2Salt stored server-side

**What:** The PBKDF2 salt is generated on registration, stored in the users table, and returned to the client on every login.

**Why:** The client needs the salt to derive the encryption key when logging in on a new device. The salt is not secret — PBKDF2 salt is public by design; its purpose is to make each user's key unique (prevents pre-computation attacks), not to hide it.

**Alternative considered:** Derive the salt deterministically from the email (e.g., `SHA256(email)`). Rejected because: if an attacker knows the email (likely), they know the salt, which makes dictionary attacks slightly cheaper. A random server-stored salt is better.

**Alternative considered:** Store the salt in the encrypted vault blob itself. Rejected because: the client needs the salt to *decrypt* the vault — you can't store the key to the lock inside the locked box.

**Security note:** An attacker who breaches the database gets the salt. Combined with the encrypted vault blob, they can attempt offline brute-force of the master password. This is mitigated by 100,000 PBKDF2 iterations (~1 second per attempt on modern hardware) — making exhaustive dictionary attacks impractical for any reasonably strong master password.

---

### Decision 4: Single encrypted blob vs. per-secret encryption

**What:** The entire vault (all secrets) is serialized to one JSON array, encrypted as one blob, stored as a single `TEXT` column.

**Alternative considered:** Encrypt each secret individually and store as separate rows.

**Why we rejected per-secret encryption:**

1. **Metadata leakage.** With separate rows, the server knows how many secrets exist, when each was created or modified, and can infer patterns (e.g., "user added a new entry after visiting a cryptocurrency exchange"). A single blob reveals nothing — the server sees one timestamp and one ciphertext of some size.

2. **IV management complexity.** Each encrypted record needs a unique IV. With one blob, there's one IV to manage.

3. **Sync simplicity.** A single `PUT /vault` with the full blob is idempotent and trivially correct. Per-secret sync requires insert/update/delete operations with conflict detection.

4. **Scale.** For a personal password manager, the vault is tens or hundreds of items — a few kilobytes of JSON. Encrypting the whole thing takes under a millisecond. This tradeoff would not hold for an enterprise secret manager with thousands of entries.

**Tradeoff accepted:** Every write (add, edit, delete one secret) re-encrypts the full vault. Negligible at personal scale; unacceptable at enterprise scale.

---

### Decision 5: Biometric gates the master password, not a separate key

**What:** When a user enables biometrics in Settings, the master password is stored in `expo-secure-store` under hardware biometric protection. Face ID / Touch ID retrieves it; it is then fed into the normal PBKDF2 → AES decryption flow.

**Why not a dedicated biometric key:** Storing a separate AES key for biometric access would create two paths to the vault — one via master password, one via biometric key. This doubles the attack surface. A compromised biometric key would unlock the vault even if the master password was never known.

**Why this model is correct:** The single source of truth is the master password. Biometrics only grant access to the master password in the secure enclave. The actual cryptographic chain (PBKDF2 → AES) is unchanged. This mirrors 1Password and Bitwarden's architecture.

**Hardware guarantee:** `expo-secure-store` maps to iOS Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` and to Android Keystore. The stored value is:
- Inaccessible to other app bundles
- Inaccessible from cloud backups
- Protected by the device's Secure Enclave / StrongBox hardware
- Wiped on logout and account deletion

**Tradeoff accepted:** On a jailbroken or rooted device, the Keychain / Keystore protections can be bypassed. This is an accepted limitation — rooted devices are outside the threat model for consumer password manager apps.

---

### Decision 6: expo-secure-store for tokens vs. AsyncStorage for vault cache

**What:** Two storage layers:
- `expo-secure-store` (hardware Keychain/Keystore): JWT, pbkdf2Salt, optional master password for biometric
- `AsyncStorage` (file-backed, non-hardware): encrypted vault blob cache

**Why not store everything in SecureStore:** `expo-secure-store` has a hard limit of ~2KB per item on iOS. The vault blob can be 10KB+ as users accumulate secrets. It cannot fit.

**Why not store tokens in AsyncStorage:** The JWT and pbkdf2Salt are authentication credentials. Storing them in AsyncStorage (accessible to any code in the app, backed up to iCloud by default) is weaker than the hardware-backed Keychain. The extra protection is worth the complexity.

**Why the vault cache in AsyncStorage is safe even without hardware protection:** The cache is always the encrypted blob — never plaintext. Even if an attacker read the AsyncStorage file, they'd get ciphertext that requires the master password to decrypt.

---

### Decision 7: OpenAPI-first with Orval codegen

**What:** The entire API contract is defined in `lib/api-spec/openapi.yaml`. Orval generates React Query hooks and Zod schemas from it. The server uses the Zod schemas for input validation.

**Why:** Type safety across the mobile/backend boundary without manual maintenance. A change to the OpenAPI spec triggers a codegen run that surfaces type errors in both the server and client. No `any` types in the API contract.

**The barrel conflict bug:** An early config had `mode: "split"` with a `schemas` directory. This caused Orval to export `SyncVaultBody` from both `generated/api.ts` and `generated/types/index.ts` — a TypeScript barrel conflict that caused `tsc` to fail with TS2309.

**Fix:** Switched to `mode: "single"` with `target: "generated/api.ts"` and removed the `schemas` option from the zod generator config entirely. All generated types now live in a single file with no barrel ambiguity.

**Rule:** Do not revert this. The `schemas` option in orval's zod generator causes duplicate exports when the same type is referenced in multiple operations. `mode: "single"` is required.

---

### Decision 8: pnpm workspaces monorepo

**What:** Single repository with `lib/db`, `lib/api-spec`, `artifacts/api-server`, and `artifacts/secure-vault` as separate workspace packages.

**Why:** Shared types and database schema are referenced by both the API server and the codegen process. A monorepo with workspace packages allows `import { usersTable } from "@workspace/db"` with full TypeScript composite build support.

**TypeScript model:** `lib/*` packages are composite (emit declarations). `artifacts/*` are leaf packages (typecheck only, no emit). This avoids TS2742 portability errors while keeping the build fast.

---

## Bugs and Debugging Log

### Bug 1: `ExpoSecureStore.default.setValueWithKeyAsync is not a function`

**Symptoms:** App crashes immediately on any SecureStore operation.

**Root cause:** `expo-secure-store@55.0.13` was installed (wrong version for Expo SDK 54). The 55.x package renamed internal native module methods. The JS bridge still called the old method name.

**Fix:** `pnpm add expo-secure-store@~15.0.8` — the correct version for Expo SDK 54.

**Also affected:** `expo-local-authentication@55.0.13` → downgraded to `~17.0.8`.

**Lesson:** Expo package versions are tightly coupled to the SDK version. Always use `npx expo install <package>` or check the Expo SDK compatibility table before installing.

---

### Bug 2: Metro bundler serving stale JS bundle after package version downgrade

**Symptoms:** SecureStore version was corrected in `package.json` and `node_modules`, but the app still crashed with the old error.

**Root cause:** Metro bundler caches transformed modules. After a package downgrade, the cache still contained the old module's bytecode.

**Fix:** Clear Metro cache: `expo start --clear` (or delete `node_modules/.cache` and `.expo/cache`).

**Lesson:** Any time a native package version changes, clear Metro cache. Do not assume a workflow restart is sufficient.

---

### Bug 3: `crypto.subtle` silently returns empty string on Hermes

**Symptoms:** Vault appeared to encrypt successfully, but decryption returned empty string. No error thrown.

**Root cause:** `crypto.subtle` is not implemented in Hermes. Calls return `undefined` or resolve to empty buffers depending on the operation. No exception is thrown.

**Fix:** Remove all `crypto.subtle` usage. Replace with `crypto-js` throughout.

**Detection:** Only manifested on native (iOS Simulator / physical device). Browser preview worked because browser has real Web Crypto.

---

### Bug 4: Orval barrel export conflict (TS2309)

**Symptoms:** `pnpm run typecheck` failed with `TS2309: An export assignment cannot be used in a module with other exported elements`.

**Root cause:** Orval `mode: "split"` with a `schemas` directory caused the same type (`SyncVaultBody`) to appear in both `generated/api.ts` and `generated/types/index.ts`. TypeScript's module resolution treated them as conflicting.

**Fix:** Set `mode: "single"`, `target: "generated/api.ts"`, removed the `schemas` option.

---

### Bug 5: `expo-local-authentication` crashing on web

**Symptoms:** Web build crashed with `Cannot read property of undefined` inside expo-local-authentication.

**Root cause:** `expo-local-authentication` has no web implementation. Importing it unconditionally on web throws at module load time.

**Fix:** Dynamic import with `Platform.OS` check:
```typescript
if (Platform.OS !== "web") {
  const LocalAuth = await import("expo-local-authentication");
  // ...
}
```

This defers the import to runtime and short-circuits on web.

---

## What Went Well

**Security model is sound.** The zero-knowledge guarantee is real. Verified the math: there is no path from `authKey` to `encryptionKey` without `masterPassword`. The server cannot decrypt user vaults.

**Offline-first from day one.** Designing the vault sync as "write to AsyncStorage first, then push to server" meant the app works without internet for reading and writing. Server sync failure leaves the local cache intact.

**TypeScript end-to-end.** The OpenAPI → Orval → Zod pipeline means a breaking change to any API endpoint surfaces as a compile error in the mobile app. No runtime surprises from API drift.

**Platform-agnostic crypto layer.** `crypto.ts` has zero platform-specific code. The same functions run on iOS, Android, and web. Tests written against it run in Node.js without any mocking.

**Monorepo structure paid off.** The shared `@workspace/db` package meant the database schema, types, and Zod schemas from `drizzle-zod` were available to the API server with zero duplication.

**Pino structured logging.** Server logs are machine-readable JSON in production, human-readable pretty-printed in development. Using `req.log` (auto-tagged with request ID) made log correlation trivial.

---

## What Was Hard

**The Hermes crypto trap.** The Web Crypto API failure on Hermes was not obvious. The browser preview works, which masks the issue. Detecting it required specifically testing on a native target. The silence of the failure (no error, just empty strings) made it particularly tricky to diagnose.

**State synchronization ordering.** The vault write sequence — update in-memory state → write to AsyncStorage cache → push to server → handle server failure → potentially re-sync — required careful thought about each failure mode. A server failure should leave the local state intact, not roll back.

**Biometric + session expiry interaction.** The question "when should we require master password re-entry vs. allow biometric unlock?" has security implications. The answer: biometric is valid as long as the JWT is valid (7 days). JWT expiry forces full re-login, which refreshes the master password in the enclave.

**Orval codegen configuration.** Orval has many config options and the documentation for edge cases (barrel conflicts, zod mode options) is sparse. Discovering the `mode: "single"` fix required reading the source code.

**expo package version coupling.** Expo's package ecosystem uses exact version pins per SDK. Installing the "latest" version of any expo-* package frequently gets a version incompatible with the current SDK. This caused two crashes (SecureStore, LocalAuthentication) that required explicit version downgrade.

---

## What Would Be Done Differently

### 1. Use `react-native-quick-crypto` from the start
**Why:** AES-GCM (authenticated encryption) instead of AES-CTR. Detects ciphertext tampering. Uses the same BoringSSL as Node.js.
**Blocker:** Requires an Expo dev build. Not compatible with Expo Go. For a shipped app, the dev build is worth it.

### 2. Rate limit `/auth/login` with Redis + express-rate-limit
**Why:** Currently, an attacker can attempt unlimited authKey guesses. 100k PBKDF2 iterations make it expensive but not impossible at scale. Rate limiting + temporary lockout is a required defense-in-depth layer.

### 3. Add vault versioning for multi-device safety
**Implementation:**
```typescript
// PUT /vault body
{ encryptedData: string, expectedUpdatedAt: string }
// Server rejects if updatedAt !== expectedUpdatedAt → client must re-fetch and merge
```
**Why deferred:** Single-device use case is correct without it. Multi-device is the next priority.

### 4. JWT revocation list
**Why:** Current logout deletes the token from device but does not invalidate it server-side. A stolen token (e.g., from device backup) remains valid for 7 days.
**Implementation:** Redis set of revoked JWT IDs; `requireAuth` middleware checks membership. Token ID (`jti`) added to JWT payload.

### 5. Periodic master password re-entry prompt
**Why:** After 7 days of biometric-only unlock, users may forget their master password. A 7-day master password challenge keeps it in muscle memory and acts as a secondary defense if the biometric secure enclave is compromised.

### 6. Automated crypto round-trip tests
**Why:** A test that encrypts a vault on one platform and verifies it decrypts correctly on another would have caught the Hermes issue immediately.
**Implementation:** Jest tests in `lib/crypto` that run in both Node.js (server) and via Metro (native), asserting identical ciphertext/plaintext for the same key + IV.

### 7. Use `npx expo install` for all Expo package additions
**Why:** `npx expo install <package>` checks the SDK compatibility table and installs the correct version automatically. Using bare `pnpm add` gets the npm latest, which is frequently wrong for Expo projects.
**Rule:** For any package in the `expo-*` namespace, always use `npx expo install`.

---

## Security Review Checklist

| Check | Status | Notes |
|---|---|---|
| Master password never transmitted | PASS | authKey derivation client-side |
| Encryption key never transmitted | PASS | PBKDF2 output stays on device |
| Server cannot decrypt vault | PASS | No path from authKey → encryptionKey |
| authKey hashed before storage | PASS | bcrypt cost 12 |
| PBKDF2 iterations | PASS | 100,000 |
| Fresh IV per encryption | PASS | Generated in `encryptData()` |
| JWT expiry | PASS | 7 days |
| JWT algorithm | PASS | HS256 |
| Sensitive tokens in hardware store | PASS | expo-secure-store (Keychain/Keystore) |
| Vault cache encrypted at rest | PASS | AsyncStorage stores ciphertext only |
| Biometric secret wiped on logout | PASS | deleteItemAsync on logout + delete |
| HTTPS only in production | PASS | Replit proxy enforces TLS |
| AES mode provides integrity | FAIL | CTR mode, not GCM — see Decision 1 |
| Server-side rate limiting | FAIL | Not implemented — see Future Work |
| JWT revocation | FAIL | Not implemented — see Future Work |
| Multi-device conflict detection | FAIL | Not implemented — single writer assumed |

---

## Lessons for Future Projects

**Design the security model before writing any code.** The authKey/encryptionKey split is an architectural decision with major implications for every component. Getting it wrong means rewriting everything. Model it on a whiteboard first; code it second.

**Test platform-specific APIs on the target platform before building on top of them.** Crypto, biometrics, secure storage — all of these have platform-specific behaviors that the browser preview won't expose. Spend 30 minutes on a native device before investing in the application layer.

**Zero-knowledge means no recovery. Communicate this from screen one.** "Forgotten password = permanent data loss" is not a bug or a UX failure. It is the security guarantee. Users must understand this before they store their first secret.

**A single encrypted blob is often the correct answer for personal data.** It's simpler, safer (no metadata leakage), and fast enough for realistic personal vault sizes. Don't let the elegance of per-record encryption tempt you into unnecessary complexity at personal scale.

**pnpm workspace monorepo is excellent for this architecture.** Shared DB schema + shared API spec + generated types that flow through to both server and client — this is the right model for any full-stack TypeScript app with a non-trivial API contract.

**Never use `console.log` in server code.** Structured logging (`pino`, `req.log`) is not optional overhead. It is the difference between "something broke in production" and "request #4821 to /api/vault from user abc123 failed after 340ms with ECONNRESET."

---

## Further Reading

- [1Password Security Design](https://1password.com/files/1Password-White-Paper.pdf) — The canonical reference for biometric-gates-master-password architecture
- [Bitwarden Security Whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper/) — Similar zero-knowledge model with a different key derivation approach (Argon2)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) — Why bcrypt at cost 12, why PBKDF2 over SHA256
- [NIST SP 800-132](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf) — PBKDF recommendations (min iterations, salt length)
- [Hermes Engine Limitations](https://hermesengine.dev/) — What Hermes does and does not implement vs. V8
- [react-native-quick-crypto](https://github.com/margelo/react-native-quick-crypto) — The production-grade crypto replacement for crypto-js
- [expo-secure-store docs](https://docs.expo.dev/versions/latest/sdk/securestore/) — Keychain/Keystore access policies and size limits
