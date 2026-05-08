# Secure Vault

A zero-knowledge mobile password manager. Users store passwords, crypto seed phrases, secure notes, and card details — all AES-256 encrypted on-device before any data touches the server. The backend is architecturally incapable of reading user data.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000/8080)
- `pnpm --filter @workspace/secure-vault run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — JWT signing secret (in Replit secrets)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: React Native + Expo (Expo Router v6)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Auth: JWT (jsonwebtoken) + bcryptjs
- Crypto: crypto-js (AES-256-CTR + PBKDF2) — NOT Web Crypto API (breaks on Hermes)
- Biometric: expo-local-authentication (Face ID / Touch ID)
- Secure storage: expo-secure-store (JWT, PBKDF2 salt, optional biometric master password)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/users.ts` — users table (email, authKeyHash, pbkdf2Salt)
- `lib/db/src/schema/vaults.ts` — vaults table (userId unique FK, encryptedData nullable text)
- `lib/api-spec/openapi.yaml` — source of truth for API contract (auth + vault routes)
- `artifacts/api-server/src/routes/auth.ts` — register, login, logout, me, delete account
- `artifacts/api-server/src/routes/vault.ts` — GET /vault, PUT /vault (encrypted blob)
- `artifacts/api-server/src/lib/jwt.ts` — token sign/verify helpers
- `artifacts/api-server/src/middleware/requireAuth.ts` — JWT middleware
- `artifacts/secure-vault/utils/crypto.ts` — AES-256 encrypt/decrypt, PBKDF2 key derivation, authKey computation
- `artifacts/secure-vault/utils/api.ts` — typed fetch helper with Bearer token support
- `artifacts/secure-vault/context/AuthContext.tsx` — JWT session management (SecureStore)
- `artifacts/secure-vault/context/VaultContext.tsx` — encrypted vault state + server sync
- `artifacts/secure-vault/hooks/useBiometric.ts` — Face ID / Touch ID abstraction
- `artifacts/secure-vault/components/PasswordGenerator.tsx` — in-app password generator modal
- `artifacts/secure-vault/components/LockScreen.tsx` — master password + biometric unlock UI
- `artifacts/secure-vault/app/auth/login.tsx` — login screen
- `artifacts/secure-vault/app/auth/register.tsx` — register screen

## Architecture decisions

- **Zero-knowledge auth**: Client sends `authKey = SHA256(masterPassword + ":auth:" + email)` — never the raw password. Server stores `bcrypt(authKey)`. Encryption key = `PBKDF2(masterPassword, pbkdf2Salt, 100000 iterations)` — never leaves device.
- **Single encrypted blob**: The entire vault is serialized to JSON, encrypted as one blob, and stored as a single ciphertext. Simpler, safer (no metadata leakage), fast enough for personal data sizes.
- **crypto-js not Web Crypto**: `crypto.subtle` silently fails on React Native's Hermes engine. crypto-js is pure JavaScript and runs identically on web/iOS/Android.
- **Biometric gates the cached master password**: Face ID/Touch ID releases the master password from the hardware-backed secure enclave. The actual decryption still goes through PBKDF2 → AES-256.
- **Server stores pbkdf2Salt**: The PBKDF2 salt is not secret — its purpose is to make encryption keys unique per user. Storing server-side means it's available on any device after login.

## Product

- Register with email + master password → zero-knowledge registration (authKey derived client-side)
- Login → receive JWT + pbkdf2Salt → derive encryption key locally → decrypt vault
- CRUD for passwords, seed phrases, secure notes, and card details
- Biometric unlock (Face ID / Touch ID) via expo-local-authentication
- In-app password generator with strength meter (⚡ button on vault screen)
- Offline-first: encrypted vault cached in AsyncStorage, synced to server on every write
- Settings: biometric toggle, change master password (re-encrypts vault), sign out, delete account

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Forgotten master password = permanent data loss.** This is intentional — zero-knowledge guarantee.
- **orval codegen** with `mode: "single"` for the zod generator. Do NOT add `schemas` option back — it causes a barrel export conflict (`SyncVaultBody` exported from both `generated/api` and `generated/types`).
- **expo-local-authentication** has no web support. The `useBiometric.ts` hook uses dynamic `import("expo-local-authentication")` with a Platform.OS check to avoid crashes on web.
- **pnpm versions**: expo-local-authentication ~17.0.8 and expo-secure-store ~15.0.8 are the correct versions for Expo SDK 54.
- **Never use `console.log` in server code.** Use `req.log` in route handlers and the singleton `logger` for non-request code.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `README.md` for full security architecture and API reference
- See `POSTMORTEM.md` for engineering decisions and lessons learned
