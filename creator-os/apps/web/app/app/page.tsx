"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Summary = {
  active_character: { id: string; name: string } | null;
  assets_generated_today: number;
  assets_awaiting_approval: number;
  posts_awaiting_approval: number;
  scheduled_next_7_days: number;
  published_last_7_days: number;
  total_views: number;
  total_link_clicks: number;
};

function Card({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>("/dashboard/summary").then(setSummary).catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!summary) return <p className="text-slate-500">Loading dashboard…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-slate-400">
          Active creator:{" "}
          <span className="text-accent">
            {summary.active_character?.name ?? "None seeded"}
          </span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Assets today" value={summary.assets_generated_today} />
        <Card label="Assets awaiting approval" value={summary.assets_awaiting_approval} />
        <Card label="Posts awaiting approval" value={summary.posts_awaiting_approval} />
        <Card label="Scheduled (next 7d)" value={summary.scheduled_next_7_days} />
        <Card label="Published (last 7d)" value={summary.published_last_7_days} />
        <Card label="Total views" value={summary.total_views} />
        <Card label="Total link clicks" value={summary.total_link_clicks} />
      </div>
    </div>
  );
}
