// app/api/backup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import { Octokit } from "@octokit/rest";

const execAsync = promisify(exec);

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const repoOwner = process.env.GITHUB_OWNER || "suhasamaresh";
const repoName = process.env.GITHUB_REPO || "index";

export async function POST(req: NextRequest) {
  const date = new Date().toISOString().split("T")[0];
  const fileName = `backup-${date}.sql`;

  try {
    // Use Docker to run pg_dump from the container
    const pgDumpCommand = `docker exec -e PGPASSWORD=suhas9481 postgres-db pg_dump -U suhas -d index > ${fileName}`;
    await execAsync(pgDumpCommand);

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

    await execAsync(`rm ${fileName}`);

    return NextResponse.json({
      message: `Backup ${fileName} created and uploaded successfully`,
      releaseUrl: release.data.html_url,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Backup failed: ${(error as Error).message}` },
      { status: 500 }
    );
    console.log(error);
  }
}