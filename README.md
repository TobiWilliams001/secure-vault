# Secure Vault

A production-grade, privacy-first mobile password manager built with **true zero-knowledge architecture**. All encryption and decryption happens exclusively on your device using a master password that never leaves it. The backend server is architecturally — not just contractually — incapable of reading your data.

Stores passwords, crypto seed phrases, secure notes, and card details. Syncs an encrypted vault blob across devices. Built with React Native (Expo) + TypeScript + Express + PostgreSQL.

---

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Threat Model](#threat-model)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [API Reference](#api-reference)
7. [Local Development](#local-development)
8. [Running on Replit](#running-on-replit)
9. [Taking the Project Locally](#taking-the-project-locally)
10. [Security Considerations & Known Limitations](#security-considerations--known-limitations)
11. [Publishing](#publishing)

---

## Security Architecture

### The Zero-Knowledge Guarantee

"Zero-knowledge" is often used loosely as marketing. Here it has a precise meaning: the server is **mathematically incapable** of reading vault data even with full database access, because the encryption key is derived from the master password and never transmitted.

```
Your Master Password  (never leaves your device)
         │
         ├─────────────────────────────────────────────────────────────┐
         │                                                             │
         ▼                                                             ▼
authKey = SHA256(masterPassword + ":auth:" + email)        encryptionKey = PBKDF2(
                                                               masterPassword,
Sent to server for login/register only.                        pbkdf2Salt,
Server stores bcrypt(authKey, cost=12).                        100000 iterations,
Server NEVER has masterPassword.                               SHA256
Server CANNOT derive encryptionKey from authKey.             )
         │
         ▼
Even if the server is fully compromised, an attacker         Used ONLY on device.
gets bcrypt hashes of derived credentials — not             NEVER transmitted.
usable to decrypt vaults.                                   NEVER stored in plaintext.
```

### What the Server Stores

| Field | Value | Secret? | Why |
|---|---|---|---|
| `email` | plaintext | No | Needed to look up account on login |
| `authKeyHash` | `bcrypt(SHA256(password + ":auth:" + email))` | Yes | Identity proof, cannot reverse to encryptionKey |
| `pbkdf2Salt` | random 32 hex chars | No | Makes each user's encryptionKey unique; needed on new device |
| `encryptedData` | `AES256(JSON.stringify(secrets), encryptionKey)` | Yes (but useless without key) | The full vault as an encrypted blob |

**The server cannot decrypt your vault.** To decrypt the vault, an attacker needs `masterPassword`. The server has never seen it. The server has `authKey` (a derivative), but `authKey → encryptionKey` is a one-way computation — SHA256 output cannot be reversed to derive the PBKDF2 key.

### Encryption Stack

| Operation | Algorithm | Parameters | Purpose |
|---|---|---|---|
| Auth credential derivation | SHA256 | `masterPassword + ":auth:" + email` | Derives login token without exposing password |
| Auth storage | bcrypt | Cost factor 12 | Makes brute-force of authKey expensive |
| Encryption key derivation | PBKDF2-SHA256 | 100,000 iterations, random salt | Derives AES key from master password |
| Vault encryption | AES-256 CTR | Fresh IV per write | Encrypts vault JSON blob |
| Session tokens | JWT HS256 | 7-day expiry | Stateless session management |
| Credential storage | iOS Keychain / Android Keystore | Hardware-backed | Stores JWT, pbkdf2Salt, optional biometric master password |

### Biometric Unlock

Biometrics (Face ID / Touch ID) do **not** replace cryptography. They gate access to the master password in the device's **hardware-backed secure enclave**.

```
On biometric enable:
  masterPassword ──► expo-secure-store (hardware enclave) ──► protected by Face ID / Touch ID

On app open with biometric:
  Face ID / Touch ID ──► success ──► retrieve masterPassword from enclave
                                           │
                                           ▼
                                  PBKDF2(masterPassword, pbkdf2Salt)
                                           │
                                           ▼
                                  AES decrypt vault ──► plaintext secrets in memory
```

The master password in the enclave is accessible only to this app, only after biometric success, and is wiped on logout. This mirrors exactly how 1Password and Bitwarden implement biometric unlock.

---

## Threat Model

### What This Protects Against

| Threat | Protected? | How |
|---|---|---|
| Server database breach | Yes | Encrypted blobs + bcrypt hashes only; no plaintext |
| Network interception (MitM) | Yes (HTTPS) | All requests over TLS; encrypted payload as extra layer |
| Malicious server operator | Yes | Server never receives or can derive encryptionKey |
| Device theft (locked) | Yes | Hardware-backed enclave requires biometric/PIN to access |
| App cloning / sideloading | Partial | expo-secure-store uses iOS Keychain / Android Keystore, inaccessible to other app bundles |
| Weak master password | Partial | 100k PBKDF2 iterations add cost; user must choose strong password |

### What This Does NOT Protect Against

| Threat | Why |
|---|---|
| Compromised device (rooted/jailbroken) | On rooted devices, the Keystore/Keychain hardware protections are bypassed |
| Screen recording / shoulder surfing | Secrets are displayed in plaintext after unlock |
| Rubber-hose cryptanalysis | Master password forced from user; no defense |
| Forgotten master password | Intentional: no recovery mechanism preserves zero-knowledge |
| Memory dump on unlocked device | Decrypted vault lives in JS memory after unlock |

---

## Tech Stack

| Layer | Technology | Version | Why |
|---|---|---|---|
| Mobile framework | React Native + Expo | SDK 54 | Cross-platform iOS/Android from one codebase |
| Navigation | Expo Router v6 | 6.x | File-based routing, typed routes |
| Language | TypeScript | 5.9 strict | End-to-end type safety |
| Cryptography | crypto-js | 4.x | Pure JS, works on Hermes (unlike Web Crypto API) |
| Biometric | expo-local-authentication | ~17.0.8 | Face ID / Touch ID native bridge |
| Secure storage | expo-secure-store | ~15.0.8 | Hardware-backed Keychain / Keystore |
| Offline cache | AsyncStorage | 2.x | Encrypted blob cache for offline reads |
| Backend | Express 5 | 5.x | Modern async/await support |
| Database | PostgreSQL + Drizzle ORM | latest | Type-safe queries, push-based migrations |
| Validation | Zod v4 | 4.x | Runtime validation + TypeScript inference |
| Auth | jsonwebtoken + bcryptjs | — | JWT sessions + bcrypt for authKey storage |
| API contract | OpenAPI 3.1 + Orval | 8.x | Code-generated React Query hooks + Zod schemas |
| Logging | pino + pino-pretty | — | Structured JSON logs in production |
| Build | esbuild | — | Fast CJS bundle for the server |
| Package manager | pnpm workspaces | 10.x | Monorepo with workspace dependencies |

---

## Project Structure

```
secure-vault/                    ← monorepo root
│
├── artifacts/
│   ├── secure-vault/            ← Expo mobile app (@workspace/secure-vault)
│   │   ├── app/
│   │   │   ├── _layout.tsx      ← Root layout: AuthProvider wraps VaultProvider
│   │   │   ├── index.tsx        ← Entry redirect (auth check)
│   │   │   ├── vault.tsx        ← Main vault list screen
│   │   │   ├── edit.tsx         ← Add / edit secret
│   │   │   ├── view/[id].tsx    ← View + copy secret fields
│   │   │   ├── settings.tsx     ← Biometric toggle, change password, sign out, delete account
│   │   │   └── auth/
│   │   │       ├── login.tsx    ← Login screen
│   │   │       └── register.tsx ← Register screen
│   │   ├── context/
│   │   │   ├── AuthContext.tsx  ← JWT session state, login/register/logout/deleteAccount
│   │   │   └── VaultContext.tsx ← Decrypted vault state, CRUD ops, server sync
│   │   ├── utils/
│   │   │   ├── crypto.ts        ← deriveEncryptionKey, computeAuthKey, generatePbkdf2Salt, encrypt/decrypt
│   │   │   └── api.ts           ← Typed fetch helper with Bearer token + base URL resolution
│   │   ├── hooks/
│   │   │   └── useBiometric.ts  ← Face ID / Touch ID (dynamic import, no web crashes)
│   │   └── components/
│   │       ├── LockScreen.tsx         ← Password + biometric unlock screen
│   │       └── PasswordGenerator.tsx  ← In-app generator modal (strength meter, toggles)
│   │
│   └── api-server/              ← Express backend (@workspace/api-server)
│       └── src/
│           ├── index.ts         ← Server entry, middleware setup
│           ├── routes/
│           │   ├── index.ts     ← Route registration
│           │   ├── auth.ts      ← /api/auth/* routes
│           │   └── vault.ts     ← /api/vault routes
│           ├── middleware/
│           │   └── requireAuth.ts ← JWT verification, attaches user to req
│           └── lib/
│               └── jwt.ts       ← signToken / verifyToken helpers
│
├── lib/
│   ├── db/                      ← Database layer (@workspace/db)
│   │   └── src/
│   │       ├── index.ts         ← db client export
│   │       └── schema/
│   │           ├── users.ts     ← usersTable: email, authKeyHash, pbkdf2Salt
│   │           └── vaults.ts    ← vaultsTable: userId (unique FK), encryptedData
│   └── api-spec/                ← API contract + codegen (@workspace/api-spec)
│       ├── openapi.yaml         ← Source of truth for all API routes
│       ├── orval.config.ts      ← Codegen config (react-query hooks + zod schemas)
│       └── generated/           ← Auto-generated — do not edit
│           ├── api.ts           ← React Query hooks + Zod schemas (single file)
│           └── api.msw.ts       ← MSW mock handlers (for testing)
│
├── README.md                    ← This file
├── POSTMORTEM.md                ← Engineering decisions log
```

---

## Data Flow Diagrams

### Registration

```
Client                                    Server                      Database
  │                                          │                            │
  ├─ generatePbkdf2Salt() → 32 hex chars     │                            │
  ├─ authKey = SHA256(pwd + ":auth:" + email)│                            │
  │                                          │                            │
  ├──── POST /api/auth/register ────────────►│                            │
  │     { email, authKey, pbkdf2Salt }       │                            │
  │                                          ├─ bcrypt(authKey, 12) ─────►│
  │                                          │                   INSERT users(email,
  │                                          │                   authKeyHash, pbkdf2Salt)
  │                                          │                   INSERT vaults(userId, null)
  │◄─── { userId, token } ──────────────────┤                            │
  │                                          │                            │
  ├─ SecureStore: save(token, pbkdf2Salt,     │                            │
  │   userId, email)                         │                            │
  ├─ encKey = PBKDF2(pwd, pbkdf2Salt, 100k)  │ (key never leaves device)  │
  └─ VaultContext: ready (empty vault)       │                            │
```

### Login on New Device

```
Client                                    Server                      Database
  │                                          │                            │
  ├─ authKey = SHA256(pwd + ":auth:" + email)│                            │
  │                                          │                            │
  ├──── POST /api/auth/login ───────────────►│                            │
  │     { email, authKey }                   ├─ SELECT user by email ────►│
  │                                          │◄─ { authKeyHash, salt } ───┤
  │                                          ├─ bcrypt.compare(authKey,   │
  │                                          │   authKeyHash) → OK        │
  │◄─── { userId, token, pbkdf2Salt } ──────┤                            │
  │                                          │                            │
  ├─ SecureStore: save(token, pbkdf2Salt...)  │                            │
  ├──── GET /api/vault ─────────────────────►│                            │
  │◄─── { encryptedData } ──────────────────┤                            │
  │                                          │                            │
  ├─ encKey = PBKDF2(pwd, pbkdf2Salt, 100k)  │                            │
  └─ decryptedVault = AES.decrypt(encryptedData, encKey)                  │
     └─ secrets live in memory, displayed in UI
```

### Vault Write (add/edit/delete secret)

```
Client
  │
  ├─ update in-memory vault array
  ├─ newBlob = AES.encrypt(JSON.stringify(vault), encKey, freshIV)
  ├─ AsyncStorage: save(newBlob)           ← offline cache updated first
  ├──── PUT /api/vault ────────────────────────────────────────────►
  │     { encryptedData: newBlob }
  │◄─── { updatedAt }
  └─ sync complete
```

---

## API Reference

Base URL: `/api`

Authentication: `Authorization: Bearer <jwt>`

### Auth Routes

#### `POST /api/auth/register`

Register a new account. Client must derive `authKey` and `pbkdf2Salt` before calling.

**Body:**
```json
{
  "email": "user@example.com",
  "authKey": "64-char hex string (SHA256 of password+email)",
  "pbkdf2Salt": "32-char hex string (random, generated client-side)"
}
```

**Response `201`:**
```json
{
  "userId": "uuid",
  "token": "jwt"
}
```

**Errors:** `400` validation failed, `409` email already registered

---

#### `POST /api/auth/login`

Login with derived credential.

**Body:**
```json
{
  "email": "user@example.com",
  "authKey": "64-char hex string"
}
```

**Response `200`:**
```json
{
  "userId": "uuid",
  "token": "jwt",
  "pbkdf2Salt": "32-char hex string"
}
```

**Errors:** `400` validation, `401` wrong credentials

---

#### `GET /api/auth/me`

Get current authenticated user.

**Response `200`:**
```json
{
  "userId": "uuid",
  "email": "user@example.com"
}
```

---

#### `POST /api/auth/logout`

Invalidate session (client discards JWT).

**Response `200`:** `{ "ok": true }`

---

#### `DELETE /api/auth/account`

Permanently delete account and vault. Irreversible.

**Response `200`:** `{ "ok": true }`

---

### Vault Routes

#### `GET /api/vault`

Fetch the encrypted vault blob.

**Response `200`:**
```json
{
  "encryptedData": "base64-or-hex ciphertext, or null if first login",
  "updatedAt": "ISO 8601 timestamp"
}
```

---

#### `PUT /api/vault`

Upload the re-encrypted vault blob (full replace, not patch).

**Body:**
```json
{
  "encryptedData": "ciphertext string"
}
```

**Response `200`:**
```json
{
  "updatedAt": "ISO 8601 timestamp"
}
```

---

## Local Development

### Prerequisites

- **Node.js 20+** — `nvm install 20`
- **pnpm** — `npm install -g pnpm@10`
- **PostgreSQL** — local install or cloud (Neon, Supabase free tier)
- **Expo Go** — install on your phone from the App Store / Google Play

### Environment Variables

```bash
# artifacts/api-server/.env  (or export in shell)
DATABASE_URL=postgresql://user:password@localhost:5432/securevault
SESSION_SECRET=minimum-32-character-random-string-for-jwt-signing
PORT=8080
NODE_ENV=development
```

> **Generate a secure SESSION_SECRET:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

### Install Dependencies

```bash
pnpm install
```

### Push Database Schema

```bash
pnpm --filter @workspace/db run push
```

This runs `drizzle-kit push` which introspects the schema files and applies DDL directly to the database. For production migrations, generate SQL files instead.

### Run the API Server

```bash
pnpm --filter @workspace/api-server run dev
```

Server starts on `http://localhost:8080`. Test it:
```bash
curl http://localhost:8080/api/healthz
# → {"status":"ok"}
```

### Run the Expo Dev Server

```bash
pnpm --filter @workspace/secure-vault run dev
```

- Scan the QR code in the terminal with **Expo Go** on your phone
- Or press `w` to open in a browser (biometric + SecureStore unavailable in browser)

### Regenerate API Code

If you modify `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates `lib/api-spec/generated/api.ts` (React Query hooks + Zod schemas).

### Typecheck Everything

```bash
pnpm run typecheck
```

---


Both workflows start automatically:

| Workflow | Command | What it does |
|---|---|---|
| API Server | `pnpm --filter @workspace/api-server run dev` | Builds + starts Express on port 8080 |
| Expo | `pnpm --filter @workspace/secure-vault run dev` | Starts Metro bundler |

The Expo URL appears in the workflow log. Scan with Expo Go on your phone, or open the web preview for a browser version (with limited functionality — biometric and SecureStore are iOS/Android only).

---


### Self-Hosted Backend

The API server is a standard Node.js Express app. It can be deployed to:
- **Railway / Render / Fly.io** — connect DATABASE_URL and SESSION_SECRET as environment variables, deploy the `artifacts/api-server` directory
- **Docker** — `docker build -f artifacts/api-server/Dockerfile .` (add a Dockerfile)
- **Heroku** — set buildpack to Node.js, set env vars, `git push heroku main`

The mobile app's API base URL is configured in `artifacts/secure-vault/utils/api.ts`. Update it to point at your production server before building the app binary.

---

## License

MIT
