import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class PayoutEncryptionConfigurationError extends Error {}
export class PayoutDecryptionError extends Error {}

export type EncryptedPayoutData = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: string;
};

function decodeBase64Key(encodedKey: string) {
  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedKey) ||
    encodedKey.length % 4 !== 0
  ) {
    throw new PayoutEncryptionConfigurationError("Payout encryption key is invalid.");
  }

  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32 || key.toString("base64") !== encodedKey) {
    throw new PayoutEncryptionConfigurationError("Payout encryption key must be 32 bytes.");
  }
  return key;
}

function payoutEncryptionConfig() {
  const encodedKey = process.env.PAYOUT_DATA_ENCRYPTION_KEY?.trim();
  const keyVersion = process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION?.trim();
  if (!encodedKey || !keyVersion) {
    throw new PayoutEncryptionConfigurationError("Payout encryption is not configured.");
  }
  return { key: decodeBase64Key(encodedKey), keyVersion };
}

function keyForVersion(keyVersion: string) {
  const current = payoutEncryptionConfig();
  if (keyVersion === current.keyVersion) return current.key;

  const keyring = process.env.PAYOUT_DATA_ENCRYPTION_KEYRING?.trim();
  if (!keyring) {
    throw new PayoutEncryptionConfigurationError("Payout encryption key version is unavailable.");
  }
  try {
    const values = JSON.parse(keyring) as Record<string, unknown>;
    const encodedKey = values[keyVersion];
    if (typeof encodedKey !== "string") {
      throw new PayoutEncryptionConfigurationError("Payout encryption key version is unavailable.");
    }
    return decodeBase64Key(encodedKey);
  } catch (error) {
    if (error instanceof PayoutEncryptionConfigurationError) throw error;
    throw new PayoutEncryptionConfigurationError("Payout encryption keyring is invalid.");
  }
}

export function encryptPayoutData(plaintext: string): EncryptedPayoutData {
  if (!plaintext) throw new Error("Payout data cannot be empty.");
  const { key, keyVersion } = payoutEncryptionConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag(), keyVersion };
}

export function decryptPayoutData(encrypted: EncryptedPayoutData) {
  if (
    encrypted.iv?.length !== 12 ||
    encrypted.authTag?.length !== 16 ||
    !encrypted.ciphertext?.length ||
    !encrypted.keyVersion
  ) {
    throw new Error("Stored payout data is incomplete.");
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyForVersion(encrypted.keyVersion),
      encrypted.iv,
    );
    decipher.setAuthTag(encrypted.authTag);
    return Buffer.concat([
      decipher.update(encrypted.ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof PayoutEncryptionConfigurationError) throw error;
    throw new PayoutDecryptionError("Stored payout data could not be decrypted.");
  }
}

export function lastFour(value: string) {
  const compact = value.replace(/\s+/g, "");
  return compact.length >= 4 ? compact.slice(-4) : compact;
}

export function maskAccountNumber(value: string) {
  const suffix = lastFour(value);
  return suffix ? `•••• ${suffix}` : null;
}
