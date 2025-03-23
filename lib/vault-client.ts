// lib/vault-client.ts
import vault from "node-vault";

const client = vault({
  apiVersion: "v1",
  endpoint: process.env.VAULT_ADDR || "http://127.0.0.1:8200",
  token: process.env.VAULT_TOKEN || "root",
});

export async function encryptWithVault(plaintext: string): Promise<string> {
  const response = await client.write("transit/encrypt/pg-creds", {
    plaintext: Buffer.from(plaintext).toString("base64"),
  });
  return response.data.ciphertext;
}

export async function decryptWithVault(ciphertext: string): Promise<string> {
  const response = await client.write("transit/decrypt/pg-creds", {
    ciphertext,
  });
  const decoded = Buffer.from(response.data.plaintext, "base64").toString("utf8");
  return decoded;
}

export async function storeInVault(userId: string, data: any) {
  await client.write(`secrets/data/${userId}`, { data }); // Updated path
}

export async function readFromVault(userId: string) {
  const response = await client.read(`secrets/data/${userId}`); // Updated path
  return response.data.data;
}

export default client;