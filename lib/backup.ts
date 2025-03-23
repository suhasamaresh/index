// lib/backup.ts
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import { Octokit } from "@octokit/rest";
import cron from "node-cron";

const execAsync = promisify(exec);

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const repoOwner = process.env.GITHUB_OWNER || "suhasamaresh";
const repoName = process.env.GITHUB_REPO || "index";

export async function backupToGitHub() {
  const date = new Date().toISOString().split("T")[0];
  const fileName = `backup-${date}.sql`;

  try {
    // Use Docker to run pg_dump from the container
    const pgDumpCommand = `docker exec postgres-db pg_dump -U suhas -d index > ${fileName}`;
    await execAsync(pgDumpCommand);
    console.log(`Database dumped to ${fileName}`);

    const tagName = `backup-${date}`;
    let release;
    try {
      release = await octokit.repos.getReleaseByTag({
        owner: repoOwner,
        repo: repoName,
        tag: tagName,
      });
    } catch (error) {
      release = await octokit.repos.createRelease({
        owner: repoOwner,
        repo: repoName,
        tag_name: tagName,
        name: `Backup for ${date}`,
        draft: false,
        prerelease: false,
      });
    }

    const fileContent = fs.readFileSync(fileName, "utf-8");
    await octokit.repos.uploadReleaseAsset({
      owner: repoOwner,
      repo: repoName,
      release_id: release.data.id,
      name: fileName,
      data: fileContent,
    });
    console.log(`Backup ${fileName} uploaded to GitHub Releases`);

    await execAsync(`rm ${fileName}`);
    console.log(`Local file ${fileName} deleted`);
  } catch (error) {
    console.error(`Backup failed: ${(error as Error).message}`);
    throw error;
  }
}

export function scheduleBackups() {
  cron.schedule("0 0 * * *", async () => {
    console.log("Starting scheduled backup...");
    await backupToGitHub();
  });
  console.log("Backup scheduled to run daily at midnight");
}

if (process.env.NODE_ENV !== "production") {
  backupToGitHub().catch(console.error);
  scheduleBackups();
}