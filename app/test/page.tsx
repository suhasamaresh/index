// app/test-encryption/page.tsx
"use client";

import { useState } from "react";
import { encryptCredentials,decryptCredentials } from "lib/encrypt";

export default function TestEncryptionPage() {
  const [credentials, setCredentials] = useState("suhas9481");
  const [secret, setSecret] = useState("vault-secret");
  const [encrypted, setEncrypted] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  // Handle encryption and store in DB
  const handleEncrypt = async () => {
    try {
      setStatus("Encrypting...");
      const response = await fetch("/api/store-encrypted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { events: [{ type: "NFT_BID" }] },
          pgCreds: credentials, // Send plaintext
          webhookId: "webhook1",
        }),
      });
      if (!response.ok) throw new Error("Failed to store in DB");
      setStatus("Encrypted and stored successfully!");
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`);
    }
  };
  // Handle decryption
  const handleDecrypt = async () => {
    try {
      if (!encrypted) {
        setStatus("Nothing to decrypt yet!");
        return;
      }
      setStatus("Decrypting...");
      const encryptedBuffer = Buffer.from(encrypted, "hex");
      const decryptedText = await decryptCredentials(encryptedBuffer, secret);
      setDecrypted(decryptedText);
      setStatus(
        decryptedText === credentials
          ? "Decrypted successfully and matches original!"
          : "Decryption failed: mismatch"
      );
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Test Encryption</h1>
      <div>
        <label>
          Credentials:
          <input
            type="text"
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </label>
      </div>
      <div>
        <label>
          Secret:
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </label>
      </div>
      <button onClick={handleEncrypt} style={{ marginRight: "10px" }}>
        Encrypt & Store
      </button>
      <button onClick={handleDecrypt}>Decrypt</button>
      <div style={{ marginTop: "20px" }}>
        <p><strong>Encrypted (hex):</strong> {encrypted || "Not encrypted yet"}</p>
        <p><strong>Decrypted:</strong> {decrypted || "Not decrypted yet"}</p>
        <p><strong>Status:</strong> {status}</p>
      </div>
    </div>
  );
}