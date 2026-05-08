import CryptoJS from "crypto-js";

/**
 * Derives the AES-256 encryption key from the master password + server-stored PBKDF2 salt.
 * The key NEVER leaves the device.
 * @param masterPassword - The user's master password (plaintext, never sent to server)
 * @param pbkdf2Salt - Hex-encoded salt returned from the server on login
 * @returns Hex-encoded 256-bit key
 */
export function deriveEncryptionKey(masterPassword: string, pbkdf2Salt: string): string {
  const key = CryptoJS.PBKDF2(
    masterPassword,
    CryptoJS.enc.Hex.parse(pbkdf2Salt),
    { keySize: 256 / 32, iterations: 100000, hasher: CryptoJS.algo.SHA256 }
  );
  return key.toString(CryptoJS.enc.Hex);
}

/**
 * Computes the authentication credential sent to the server.
 * The master password is NEVER sent — only this derived credential.
 * Server stores bcrypt(authKey).
 * @param masterPassword - The user's master password
 * @param email - The user's email (normalized to lowercase)
 * @returns Hex-encoded SHA256 of (masterPassword + ":auth:" + email)
 */
export function computeAuthKey(masterPassword: string, email: string): string {
  return CryptoJS.SHA256(
    masterPassword + ":auth:" + email.toLowerCase()
  ).toString(CryptoJS.enc.Hex);
}

/**
 * Generates a random hex salt for PBKDF2 key derivation.
 * This is stored server-side and is NOT a secret —
 * it only ensures each user's encryption key is unique.
 */
export function generatePbkdf2Salt(): string {
  return CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
}

/**
 * Encrypts plaintext with a pre-derived AES-256 hex key (CTR mode).
 * A random IV is generated for every encryption call.
 * @param plaintext - Data to encrypt
 * @param hexKey - 256-bit key as hex string (from deriveEncryptionKey)
 */
export async function encryptData(plaintext: string, hexKey: string): Promise<string> {
  const iv = CryptoJS.lib.WordArray.random(16);
  const keyWA = CryptoJS.enc.Hex.parse(hexKey);
  const encrypted = CryptoJS.AES.encrypt(plaintext, keyWA, {
    iv,
    mode: CryptoJS.mode.CTR,
    padding: CryptoJS.pad.NoPadding,
  });
  const combined = {
    iv: iv.toString(CryptoJS.enc.Base64),
    ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
  };
  return btoa(JSON.stringify(combined));
}

/**
 * Decrypts ciphertext produced by encryptData.
 * @param encryptedBase64 - Output of encryptData
 * @param hexKey - Same 256-bit key used for encryption
 */
export async function decryptData(encryptedBase64: string, hexKey: string): Promise<string> {
  try {
    const { iv, ct } = JSON.parse(atob(encryptedBase64)) as { iv: string; ct: string };
    const ivWA = CryptoJS.enc.Base64.parse(iv);
    const ctWA = CryptoJS.enc.Base64.parse(ct);
    const keyWA = CryptoJS.enc.Hex.parse(hexKey);
    const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ctWA });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, keyWA, {
      iv: ivWA,
      mode: CryptoJS.mode.CTR,
      padding: CryptoJS.pad.NoPadding,
    });
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    if (!plaintext) throw new Error("DECRYPT_FAILED");
    return plaintext;
  } catch {
    throw new Error("DECRYPT_FAILED");
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
