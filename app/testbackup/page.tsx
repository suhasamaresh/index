// app/backup/page.tsx
"use client";

import { useState } from "react";

export default function BackupPage() {
  const [status, setStatus] = useState<string>("");
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);

  const handleBackup = async () => {
    setStatus("Creating backup...");
    try {
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Backup failed");
      }

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
      <button
        onClick={handleBackup}
        style={{ padding: "10px 20px", marginBottom: "20px" }}
      >
        Create Backup
      </button>
      <div>
        <p><strong>Status:</strong> {status || "Click to start a backup"}</p>
        {releaseUrl && (
          <p>
            <strong>Release URL:</strong>{" "}
            <a href={releaseUrl} target="_blank" rel="noopener noreferrer">
              {releaseUrl}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}