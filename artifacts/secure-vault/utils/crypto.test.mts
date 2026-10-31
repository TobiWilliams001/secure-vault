import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeAuthKey,
  decryptData,
  deriveEncryptionKey,
  encryptData,
  generatePbkdf2Salt,
} from "./crypto.ts";

const SALT = "00112233445566778899aabbccddeeff";
const SECRET = JSON.stringify({ title: "Bank", password: "correct horse battery staple" });

test("a vault encrypted with a key decrypts with the same key", async () => {
  const key = deriveEncryptionKey("master password", SALT);
  assert.equal(await decryptData(await encryptData(SECRET, key), key), SECRET);
});

test("the wrong master password cannot decrypt the vault", async () => {
  const blob = await encryptData(SECRET, deriveEncryptionKey("master password", SALT));
  const wrongKey = deriveEncryptionKey("master passwore", SALT);
  await assert.rejects(decryptData(blob, wrongKey), /DECRYPT_FAILED/);
});

test("encrypting the same data twice gives different ciphertext", async () => {
  const key = deriveEncryptionKey("master password", SALT);
  assert.notEqual(await encryptData(SECRET, key), await encryptData(SECRET, key));
});

test("the key depends on both the password and the salt", () => {
  const key = deriveEncryptionKey("master password", SALT);
  assert.equal(key.length, 64);
  assert.equal(deriveEncryptionKey("master password", SALT), key);
  assert.notEqual(deriveEncryptionKey("master password", generatePbkdf2Salt()), key);
  assert.notEqual(deriveEncryptionKey("Master password", SALT), key);
});

test("the auth credential never contains the encryption key or the password", () => {
  const authKey = computeAuthKey("master password", "Tobi@Example.com");
  assert.equal(authKey, computeAuthKey("master password", "tobi@example.com"));
  assert.notEqual(authKey, deriveEncryptionKey("master password", SALT));
  assert.ok(!authKey.includes("master"));
});

test("corrupted vault data fails instead of returning garbage", async () => {
  await assert.rejects(decryptData("not-a-vault", deriveEncryptionKey("x", SALT)), /DECRYPT_FAILED/);
});
