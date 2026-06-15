"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("change-me");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/app");
    } catch {
      setError("Invalid credentials. Check ADMIN_EMAIL / ADMIN_PASSWORD.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-accent">
            Creator OS Alpha
          </div>
          <h1 className="mt-1 text-xl font-semibold text-white">Operator login</h1>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-400">Email</label>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="username"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-400">Password</label>
          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
