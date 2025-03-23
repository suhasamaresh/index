
---

### **`PHASE1.md`**

```markdown
# Phase 1: Secure Foundation

This phase establishes a robust, secure backend for the "Index" application, integrating Postgres with Prisma, Vault for encryption, NextAuth for authentication, and geo-redundant backups via GitHub Releases. Below is a detailed chronicle of every step, file, command, issue, and resolution, with specifics on deployment changes for Phase 4.

---

## Steps Completed

### Step 1.1–2.4: Database Setup with Docker and Prisma

#### **Objective**
Set up a Postgres database with Row-Level Security (RLS) and JSONB validation, managed by Prisma for ORM functionality.

#### **Detailed Actions**
1. **Dockerized Postgres**:
   - **Command**: Launched a Postgres 17.4 container using Docker:
     ```bash
     docker run -d --name postgres-db -e POSTGRES_USER=suhas -e POSTGRES_PASSWORD=suhas9481 -e POSTGRES_DB=index -p 5432:5432 -v postgres-data:/var/lib/postgresql/data postgres:latest
     ```
   - **Details**:
     - `-d`: Detached mode.
     - `--name postgres-db`: Named the container.
     - `-e`: Set environment variables for user (`suhas`), password (`suhas9481`), and database (`index`).
     - `-p 5432:5432`: Exposed port 5432 locally.
     - `-v`: Persisted data in a Docker volume (`postgres-data`).
     - `postgres:latest`: Used the latest Postgres image (17.4 as of March 2025).
   - **Verification**:
     ```bash
     docker ps
     ```
     - Confirmed container running with ID and ports.

2. **Prisma Setup**:
   - **File**: `prisma/schema.prisma`:
     ```prisma
     generator client {
       provider = "prisma-client-js"
     }

     datasource db {
       provider = "postgresql"
       url      = env("DATABASE_URL")
     }

     model UserIndexPrefs {
       userId    String   @id @default(uuid()) @db.Uuid
       config    Json     @db.JsonB
       pgCreds   Bytes?   @db.ByteA
       webhookId String   @unique @db.Text
     }
     ```
   - **Environment**: Added to `.env.local`:
     ```
     DATABASE_URL=postgresql://suhas:suhas9481@localhost:5432/index?schema=public
     ```
   - **Migration**:
     ```bash
     npx prisma migrate dev --name init
     ```
     - Generated and applied migration files in `prisma/migrations/`.
     - Created `"UserIndexPrefs"` table with columns: `userId` (UUID), `config` (JSONB), `pgCreds` (BYTEA), `webhookId` (TEXT, unique).

3. **Security Enhancements**:
   - **Connected to DB**:
     ```bash
     psql -h localhost -U suhas -d index
     ```
     - Entered password `suhas9481` when prompted.
   - **SQL Commands**:
     ```sql
     CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
     ALTER TABLE "UserIndexPrefs" ALTER COLUMN "userId" SET DEFAULT uuid_generate_v4();
     ALTER TABLE "UserIndexPrefs" ADD CHECK (config @? '$.events[*] ? (@.type == "NFT_BID" || @.type == "TOKEN_PRICE")');
     ALTER TABLE "UserIndexPrefs" ENABLE ROW LEVEL SECURITY;
     CREATE POLICY user_isolation ON "UserIndexPrefs" USING (current_user = "userId"::text);
     ```
     - **Details**:
       - `uuid-ossp`: Enabled UUID generation.
       - `SET DEFAULT uuid_generate_v4()`: Auto-generated UUIDs for `userId`.
       - `CHECK`: Ensured `config` JSONB only contains `NFT_BID` or `TOKEN_PRICE` events.
       - `ENABLE ROW LEVEL SECURITY`: Activated RLS.
       - `CREATE POLICY`: Restricted row access to matching `userId`.
   - **Verification**:
     ```sql
     \d "UserIndexPrefs"
     ```
     - Confirmed table structure and constraints.

#### **Outcome**
A secure Postgres database with `"UserIndexPrefs"` table, enforcing UUIDs, JSONB validation, and RLS.

---

### Step 2.5: Encrypt Credentials with Vault

#### **Objective**
Securely encrypt `pgCreds` before storage, initially mocked, then replaced with HashiCorp Vault.

#### **Detailed Actions**
1. **Initial Mock Encryption**:
   - **File**: `lib/encrypt.ts`:
     ```typescript
     import * as crypto from "crypto";

     export async function encryptCredentials(creds: string, secret: string): Promise<Buffer> {
       const iv = crypto.randomBytes(12);
       const key = crypto.createHash("sha256").update(secret).digest();
       const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
       const encrypted = Buffer.concat([cipher.update(creds, "utf8"), cipher.final()]);
       const authTag = cipher.getAuthTag();
       return Buffer.concat([iv, encrypted, authTag]);
     }

     export async function decryptCredentials(encrypted: Buffer, secret: string): Promise<string> {
       const key = crypto.createHash("sha256").update(secret).digest();
       const iv = encrypted.subarray(0, 12);
       const authTag = encrypted.subarray(encrypted.length - 16);
       const encryptedData = encrypted.subarray(12, encrypted.length - 16);
       const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
       decipher.setAuthTag(authTag);
       return decipher.update(encryptedData) + decipher.final("utf8");
     }
     ```
   - **Purpose**: Mocked AES-GCM encryption for testing.
   - **Status**: Deprecated after Vault integration.

2. **Vault Installation**:
   - **Commands**:
     ```bash
     wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
     echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
     sudo apt update && sudo apt install vault
     ```
     - Fixed typo in initial command (`gpgor` → correct syntax).
   - **Run Vault**:
     ```bash
     vault server -dev -dev-root-token-id="root"
     ```
     - Output: `Api Address: http://127.0.0.1:8200`, `Root Token: root`.

3. **Vault Configuration**:
   - **Enable Engines**:
     ```bash
     export VAULT_ADDR="http://127.0.0.1:8200"
     export VAULT_TOKEN="root"
     vault secrets enable transit
     vault write -f transit/keys/pg-creds
     vault secrets enable -path=secrets kv-v2
     ```
     - **Issue**: `secret/` path conflict (pre-existing in dev mode).
     - **Resolution**: Used `secrets/` instead of `secret/`.
   - **Verification**:
     ```bash
     vault write transit/encrypt/pg-creds plaintext=$(base64 <<< "suhas9481")
     ```
     - Output: `ciphertext=vault:v1:<encrypted-data>`.

4. **Vault Integration**:
   - **File**: `lib/vault-client.ts`:
     ```typescript
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
       const response = await client.write("transit/decrypt/pg-creds", { ciphertext });
       return Buffer.from(response.data.plaintext, "base64").toString("utf8");
     }

     export async function storeInVault(userId: string, data: any) {
       await client.write(`secrets/data/${userId}`, { data });
     }

     export async function readFromVault(userId: string) {
       const response = await client.read(`secrets/data/${userId}`);
       return response.data.data;
     }

     export default client;
     ```
   - **Details**: Handles encryption, decryption, and KV storage with Vault.

#### **Outcome**
Replaced mock encryption with Vault’s Transit engine, ensuring secure `pgCreds` storage.

---

### Step 2.6: Prisma Migration

#### **Objective**
Sync Prisma schema with manual DB changes (RLS, CHECK constraints).

#### **Detailed Actions**
- **Commands**:
  ```bash
  npx prisma migrate reset
  npx prisma migrate dev --name init
  ```
  - `reset`: Cleared existing migrations for a fresh start.
  - `dev`: Reapplied schema changes.
- **Verification**:
  ```bash
  psql -h localhost -U suhas -d index -c '\d "UserIndexPrefs"'
  ```
  - Confirmed columns and constraints (UUID default added manually).

#### **Outcome**
Prisma manages the schema, with RLS and CHECK constraints applied via SQL.

---

### Step 3.1: Connection Validator

#### **Objective**
Validate Postgres credentials dynamically for potential multi-tenant use.

#### **Detailed Actions**
1. **Validator**:
   - **File**: `lib/db-validator.ts`:
     ```typescript
     import { Client } from "pg";

     export async function validatePgConnection(creds: { host: string; user: string; password: string; database: string }) {
       const client = new Client({ host: creds.host, user: creds.user, password: creds.password, database: creds.database, port: 5432 });
       try {
         await client.connect();
         const res = await client.query("SELECT NOW()");
         await client.end();
         return { success: true, timestamp: res.rows[0].now };
       } catch (error) {
         await client.end();
         return { success: false, error: (error as Error).message };
       }
     }
     ```
2. **API Route**:
   - **File**: `pages/api/validate-db.ts`:
     ```typescript
     import { NextApiRequest, NextApiResponse } from "next";
     import { validatePgConnection } from "@/lib/db-validator";

     export default async function handler(req: NextApiRequest, res: NextApiResponse) {
       if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
       try {
         const { host, user, password, database } = req.body;
         if (!host || !user || !password || !database) return res.status(400).json({ error: "Missing required fields" });
         const result = await validatePgConnection({ host, user, password, database });
         return res.status(result.success ? 200 : 400).json(result);
       } catch (error) {
         return res.status(500).json({ error: (error as Error).message });
       }
     }
     ```
   - **Test**:
     ```bash
     curl -X POST http://localhost:3000/api/validate-db -H "Content-Type: application/json" -d '{"host": "localhost", "user": "suhas", "password": "suhas9481", "database": "index"}'
     ```
     - Output: `{ "success": true, "timestamp": "2025-03-23T..." }`.

#### **Outcome**
A utility to validate DB connections, not yet integrated into core workflows.

---

### Step 3.2: Vault Integration

#### **Objective**
Fully integrate Vault into the app for credential management.

#### **Detailed Actions**
1. **API Route**:
   - **File**: `pages/api/store-encrypted.ts`:
     ```typescript
     import { NextApiRequest, NextApiResponse } from "next";
     import { PrismaClient } from "@prisma/client";
     import { encryptWithVault } from "@/lib/vault-client";

     const prisma = new PrismaClient();

     export default async function handler(req: NextApiRequest, res: NextApiResponse) {
       if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
       try {
         const { config, pgCreds, webhookId } = req.body;
         if (!config || !pgCreds || !webhookId) return res.status(400).json({ error: "Missing required fields" });
         const encryptedCreds = await encryptWithVault(pgCreds);
         const result = await prisma.userIndexPrefs.upsert({
           where: { webhookId },
           update: { config, pgCreds: Buffer.from(encryptedCreds) },
           create: { config, pgCreds: Buffer.from(encryptedCreds), webhookId },
         });
         return res.status(200).json({ message: "Stored successfully", result });
       } catch (error) {
         return res.status(500).json({ error: (error as Error).message });
       } finally {
         await prisma.$disconnect();
       }
     }
     ```
2. **Frontend**:
   - **File**: `app/test-encryption/page.tsx`:
     ```typescript
     "use client";
     import { useState } from "react";
     import { useSession, signOut } from "next-auth/react";
     import { encryptWithVault, decryptWithVault } from "@/lib/vault-client";

     export default function TestEncryption() {
       const { data: session } = useSession();
       const [credentials, setCredentials] = useState("suhas9481");
       const [encrypted, setEncrypted] = useState("");
       const [decrypted, setDecrypted] = useState("");
       const [status, setStatus] = useState("");

       if (!session) return <div>Please sign in</div>;

       const handleEncrypt = async () => {
         setStatus("Encrypting...");
         try {
           const response = await fetch("/api/store-encrypted", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ config: { events: [{ type: "NFT_BID" }] }, pgCreds: credentials, webhookId: "webhook1" }),
           });
           if (!response.ok) throw new Error((await response.json()).error);
           const { result } = await response.json();
           setEncrypted(result.pgCreds.toString("hex"));
           setStatus("Encrypted and stored successfully!");
         } catch (error) {
           setStatus(`Error: ${(error as Error).message}`);
         }
       };

       const handleDecrypt = async () => {
         setStatus("Decrypting...");
         try {
           const decryptedText = await decryptWithVault(encrypted);
           setDecrypted(decryptedText);
           setStatus(`Decrypted successfully and matches original: ${decryptedText === credentials}`);
         } catch (error) {
           setStatus(`Error: ${(error as Error).message}`);
         }
       };

       return (
         <div style={{ padding: "20px" }}>
           <h1>Test Encryption with Vault</h1>
           <p>User: {session.user?.name}</p>
           <button onClick={() => signOut()}>Sign Out</button>
           <input value={credentials} onChange={(e) => setCredentials(e.target.value)} />
           <button onClick={handleEncrypt}>Encrypt & Store</button>
           <button onClick={handleDecrypt}>Decrypt</button>
           <p><strong>Encrypted:</strong> {encrypted}</p>
           <p><strong>Decrypted:</strong> {decrypted}</p>
           <p><strong>Status:</strong> {status}</p>
         </div>
       );
     }
     ```
   - **Test**: Visited `http://localhost:3000/test-encryption` after signing in.

#### **Outcome**
Vault fully powers encryption in the app’s backend and frontend.

---

### Step 3.3: Geo-Redundant Backups

#### **Objective**
Automate daily backups with geo-redundant storage.

#### **Detailed Actions**
1. **Initial Mock**:
   - **File**: `lib/backup.ts` (deprecated):
     ```typescript
     export async function backupToS3() {
       const date = new Date().toISOString().split("T")[0];
       const fileName = `backup-${date}.sql`;
       await execAsync(`pg_dump -h localhost -U suhas -d index > ${fileName}`);
       console.log(`Mock: Uploaded ${fileName} to S3`);
     }
     ```

2. **Real Implementation**:
   - **Attempt with AWS S3**:
     - Required credit card, abandoned for free alternative.
   - **GitHub Releases**:
     - **API Route**: `app/api/backup/route.ts`:
       ```typescript
       import { NextRequest, NextResponse } from "next/server";
       import { exec } from "child_process";
       import { promisify } from "util";
       import * as fs from "fs";
       import { Octokit } from "@octokit/rest";

       const execAsync = promisify(exec);
       const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
       const repoOwner = process.env.GITHUB_OWNER || "suhasamaresh";
       const repoName = process.env.GITHUB_REPO || "index";

       export async function POST(req: NextRequest) {
         const date = new Date().toISOString().split("T")[0];
         const fileName = `backup-${date}.sql`;
         try {
           const pgDumpCommand = `docker exec -e PGPASSWORD=suhas9481 postgres-db pg_dump -U suhas -d index > ${fileName}`;
           await execAsync(pgDumpCommand);
           const tagName = `backup-${date}`;
           let release;
           try {
             release = await octokit.repos.getReleaseByTag({ owner: repoOwner, repo: repoName, tag: tagName });
           } catch (error) {
             release = await octokit.repos.createRelease({ owner: repoOwner, repo: repoName, tag_name: tagName, name: `Backup for ${date}`, draft: false, prerelease: false });
           }
           const fileContent = fs.readFileSync(fileName, "utf-8");
           await octokit.repos.uploadReleaseAsset({ owner: repoOwner, repo: repoName, release_id: release.data.id, name: fileName, data: fileContent });
           await execAsync(`rm ${fileName}`);
           return NextResponse.json({ message: `Backup ${fileName} created and uploaded successfully`, releaseUrl: release.data.html_url });
         } catch (error) {
           return NextResponse.json({ error: `Backup failed: ${(error as Error).message}` }, { status: 500 });
         }
       }
       ```
     - **Page**: `app/backup/page.tsx`:
       ```typescript
       "use client";
       import { useState } from "react";

       export default function BackupPage() {
         const [status, setStatus] = useState<string>("");
         const [releaseUrl, setReleaseUrl] = useState<string | null>(null);

         const handleBackup = async () => {
           setStatus("Creating backup...");
           try {
             const response = await fetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json" } });
             const data = await response.json();
             if (!response.ok) throw new Error(data.error || "Backup failed");
             setStatus(data.message);
             setReleaseUrl(data.releaseUrl);
           } catch (error) {
             setStatus(`Error: ${(error as Error).message}`);
             setReleaseUrl(null);
           }
         };

         return (
           <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
             <h1>Database Backup</h1>
             <button onClick={handleBackup} style={{ padding: "10px 20px", marginBottom: "20px" }}>Create Backup</button>
             <div>
               <p><strong>Status:</strong> {status || "Click to start a backup"}</p>
               {releaseUrl && <p><strong>Release URL:</strong> <a href={releaseUrl} target="_blank" rel="noopener noreferrer">{releaseUrl}</a></p>}
             </div>
           </div>
         );
       }
       ```
   - **Issues**:
     - **Version Mismatch**: `pg_dump` 15.12 vs. Postgres 17.4.
       - **Fix**: Used Dockerized `pg_dump` with `docker exec`.
     - **Password Prompt**: Added `PGPASSWORD=suhas9481`.
     - **Empty Repo**: Failed with “Repository is empty.”
       - **Fix**: Pushed code to `suhasamaresh/index`.

3. **Testing**:
   - **Commands**:
     ```bash
     docker start postgres-db
     vault server -dev -dev-root-token-id="root"
     npm run dev
     ```
   - Visited `http://localhost:3000/backup`, clicked “Create Backup”.

#### **Outcome**
Backups are created and uploaded to GitHub Releases, verified via UI.

---

### Additional Feature: NextAuth with JWT

#### **Objective**
Implement secure user authentication.

#### **Detailed Actions**
1. **Configuration**:
   - **File**: `pages/api/auth/[...nextauth].ts`:
     ```typescript
     import NextAuth from "next-auth";
     import CredentialsProvider from "next-auth/providers/credentials";
     import { PrismaClient } from "@prisma/client";
     import { decryptWithVault } from "@/lib/vault-client";

     const prisma = new PrismaClient();

     export default NextAuth({
       providers: [
         CredentialsProvider({
           name: "Credentials",
           credentials: { username: { label: "Username" }, password: { label: "Password", type: "password" } },
           async authorize(credentials) {
             if (!credentials?.username || !credentials?.password) return null;
             const user = await prisma.userIndexPrefs.findFirst({ where: { webhookId: credentials.username } });
             if (!user || !user.pgCreds) return null;
             const storedPassword = await decryptWithVault(user.pgCreds.toString("utf8"));
             if (storedPassword === credentials.password) return { id: user.userId, name: credentials.username };
             return null;
           },
         }),
       ],
       session: { strategy: "jwt" },
       jwt: { secret: process.env.JWT_SECRET },
       callbacks: {
         async jwt({ token, user }) { if (user) token.id = user.id; return token; },
         async session({ session, token }) { if (token?.id) session.user.id = token.id as string; return session; },
       },
       pages: { signIn: "/auth/signin" },
     });
     ```
2. **Sign-In Page**:
   - **File**: `app/auth/signin/page.tsx`:
     ```typescript
     "use client";
     import { useState } from "react";
     import { signIn } from "next-auth/react";
     import { useRouter } from "next/navigation";

     export default function SignIn() {
       const [username, setUsername] = useState("");
       const [password, setPassword] = useState("");
       const [error, setError] = useState("");
       const router = useRouter();

       const handleSubmit = async () => {
         const result = await signIn("credentials", { redirect: false, username, password });
         if (result?.error) setError(result.error);
         else router.push("/test-encryption");
       };

       return (
         <div style={{ padding: "20px" }}>
           <h1>Sign In</h1>
           <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
           <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
           <button onClick={handleSubmit}>Sign In</button>
           {error && <p>{error}</p>}
         </div>
       );
     }
     ```
3. **Testing**:
   - Signed in with `webhook1`/`suhas9481` at `http://localhost:3000/auth/signin`.

#### **Outcome**
Secure JWT-based authentication with NextAuth.

---

## File Purposes

| **File**                        | **Purpose**                                                                                   | **Status**         |
|---------------------------------|----------------------------------------------------------------------------------------------|--------------------|
| `prisma/schema.prisma`          | Defines `"UserIndexPrefs"` with UUID, JSONB, Bytes, and unique `webhookId`.                  | Active             |
| `lib/vault-client.ts`           | Encrypts/decrypts `pgCreds` with Vault’s Transit engine, manages KV storage.                 | Active             |
| `lib/db-validator.ts`           | Validates Postgres credentials dynamically (not integrated into core flows).                 | Active, Unused     |
| `lib/encrypt.ts`                | Mock AES-GCM encryption (replaced by Vault).                                                 | Deprecated         |
| `lib/backup.ts`                 | Original backup script with cron (replaced by API route).                                    | Deprecated         |
| `pages/api/auth/[...nextauth].ts` | Configures NextAuth with JWT and Credentials provider.                                     | Active             |
| `pages/api/validate-db.ts`      | API endpoint to validate DB connections.                                                     | Active, Unused     |
| `pages/api/store-encrypted.ts`  | Encrypts `pgCreds` with Vault and stores in `"UserIndexPrefs"`.                              | Active             |
| `app/auth/signin/page.tsx`      | UI for NextAuth sign-in with `webhookId` and `pgCreds`.                                      | Active             |
| `app/test-encryption/page.tsx`  | Tests Vault encryption/decryption and stores data via `/api/store-encrypted`.                | Active             |
| `app/api/backup/route.ts`       | Dumps Postgres DB and uploads to GitHub Releases.                                            | Active             |
| `app/backup/page.tsx`           | Triggers and verifies backups via `/api/backup`.                                             | Active             |
| `scripts/start-backups.ts`      | Schedules backups (unused after moving to API route).                                        | Deprecated         |
| `.env.local`                    | Stores environment variables (`DATABASE_URL`, `VAULT_ADDR`, `GITHUB_TOKEN`, etc.).           | Active             |

---

## Deployment Changes (Phase 4)

### **General Considerations**
- **Platform**: Vercel (serverless), requiring adjustments for scheduling and file system access.
- **Database**: Move from local Docker to a hosted Postgres service.
- **Vault**: Transition from local dev to a production Vault instance.

### **Specific Changes**
1. **Postgres**:
   - **Current**: Docker container (`localhost:5432`, `suhas`, `suhas9481`).
   - **Deployment**: Use Neon free tier (e.g., `postgresql://user:pass@neon-host/index`).
   - **Change**:
     - Update `DATABASE_URL` in Vercel’s environment variables.
     - Run `npx prisma migrate deploy` on Neon.

2. **Vault**:
   - **Current**: Local dev (`http://127.0.0.1:8200`, `root` token).
   - **Deployment**: HCP Vault or self-hosted with TLS (e.g., `https://vault.yourdomain.com:8200`).
   - **Change**:
     - Update `lib/vault-client.ts`:
       ```typescript
       const client = vault({ endpoint: process.env.VAULT_ADDR });
       async function authenticateWithAppRole() {
         const response = await client.write("auth/approle/login", { role_id: process.env.VAULT_ROLE_ID, secret_id: process.env.VAULT_SECRET_ID });
         client.token = response.auth.client_token;
       }
       ```
     - Add `VAULT_ADDR`, `VAULT_ROLE_ID`, `VAULT_SECRET_ID` to Vercel.

3. **Backups**:
   - **Current**: `app/api/backup/route.ts` uses `docker exec` and `fs`.
   - **Deployment**: Vercel can’t run Docker or cron; file system is read-only.
   - **Change**:
     - Use GitHub Actions:
       ```yaml
       name: Daily Backup
       on: schedule: [{ cron: "0 0 * * *" }]
       jobs:
         backup:
           runs-on: ubuntu-latest
           steps:
             - uses: actions/checkout@v3
             - run: sudo apt install -y postgresql-client
             - run: pg_dump $DATABASE_URL > backup-$(date +%Y-%m-%d).sql
             - uses: actions/upload-artifact@v3
               with: { name: "backup", path: "backup-*.sql" }
       ```
     - Store in artifacts or Releases.
     - Update `app/backup/page.tsx` to fetch latest backup URL from GitHub API.

4. **File System**:
   - **Current**: `fs.readFileSync`, `rm` in `app/api/backup/route.ts`.
   - **Deployment**: Vercel’s `/tmp` is ephemeral; avoid local files.
   - **Change**: Stream `pg_dump` output directly (e.g., via `pg` client) or offload to GitHub Actions.

5. **NextAuth**:
   - **Current**: `NEXTAUTH_URL=http://localhost:3000`.
   - **Deployment**: Set to Vercel domain (e.g., `https://index.vercel.app`).
   - **Change**: Update in Vercel environment variables.

6. **Environment Variables**:
   - **Current**: `.env.local`:
     ```
     DATABASE_URL=postgresql://suhas:suhas9481@localhost:5432/index?schema=public
     VAULT_ADDR=http://127.0.0.1:8200
     VAULT_TOKEN=root
     GITHUB_TOKEN=ghp_<your-token>
     GITHUB_OWNER=suhasamaresh
     GITHUB_REPO=index
     NEXTAUTH_URL=http://localhost:3000
     NEXTAUTH_SECRET=<your-secret>
     JWT_SECRET=<your-secret>
     ```
   - **Deployment**: Add all to Vercel’s project settings > Environment Variables.

---

## Next Steps
- Push this file to `suhasamaresh/index`.
- Test `/backup` after repo initialization.
- Proceed to Phase 2: Helius Powerhouse with Redis and webhook indexing.

---
```

---

### **How to Add It**
1. **Create the File**:
   - In your `index` directory:
     ```bash
     touch PHASE1.md
     ```
   - Copy the above content into `PHASE1.md`.

2. **Commit and Push**:
   ```bash
   git add PHASE1.md
   git commit -m "Add detailed Phase 1 documentation"
   git push origin main
   ```

3. **Verify**:
   - Check `https://github.com/suhasamaresh/index/blob/main/PHASE1.md`.

---

