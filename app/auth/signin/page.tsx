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
    console.log("Submitting:", { username, password });
    const result = await signIn("credentials", { redirect: false, username, password });
    console.log("SignIn result:", result);
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