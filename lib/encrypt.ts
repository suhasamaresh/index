// lib/encrypt.ts
import { Crypto } from "@peculiar/webcrypto";

// Derive a 32-byte key from the secret using SHA-256
async function deriveKey(secret: string): Promise<ArrayBuffer> {
  const crypto = new Crypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  return await crypto.subtle.digest("SHA-256", data); // Returns 32 bytes
}

export async function encryptCredentials(creds: string, secret: string): Promise<Buffer> {
  const crypto = new Crypto();
  const keyData = await deriveKey(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(creds)
  );
  return Buffer.concat([Buffer.from(iv), Buffer.from(encrypted)]);
}

export  async function decryptCredentials(encrypted: Buffer, secret: string): Promise<string> {
  const crypto = new Crypto();
  const keyData = await deriveKey(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const iv = encrypted.subarray(0, 12);
  const data = encrypted.subarray(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
}

// Test function
async function testEncryption() {
  try {
    const credentials = "my-postgres-password";
    const secret = "vault-secret";

    // Encrypt
    const encrypted = await encryptCredentials(credentials, secret);
    console.log("Encrypted (hex):", encrypted.toString("hex"));

    // Decrypt
    const decrypted = await decryptCredentials(encrypted, secret);
    console.log("Decrypted:", decrypted);

    // Verify
    if (decrypted === credentials) {
      console.log("Test passed: Decrypted value matches original!");
    } else {
      console.error("Test failed: Decrypted value does not match original!");
    }
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

