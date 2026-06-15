"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Asset = {
  id: string;
  title: string | null;
  asset_type: string;
  status: string;
  public_url: string | null;
  provider_type: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  approved: "border-green-500 text-green-400",
  rejected: "border-red-500 text-red-400",
  generated: "border-blue-500 text-blue-400",
  uploaded: "border-slate-500 text-slate-300",
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);

  function load() {
    api<Asset[]>("/assets").then(setAssets).catch(() => setAssets([]));
  }
  useEffect(load, []);

  async function act(id: string, action: "approve" | "reject") {
    await api(`/assets/${id}/${action}`, {
      method: "POST",
      body: action === "reject" ? JSON.stringify({ reason: "manual reject" }) : undefined,
    });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Asset Library</h1>
      {assets.length === 0 && (
        <p className="text-slate-500">
          No assets yet. Use the Generator (or POST /generation-jobs) to create some with the mock provider.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {assets.map((a) => (
          <div key={a.id} className="card space-y-2">
            <div className="flex aspect-[9/16] items-center justify-center rounded-lg bg-ink text-xs text-slate-600">
              {a.asset_type}
            </div>
            <div className="truncate text-sm text-slate-200">{a.title ?? "Untitled"}</div>
            <span className={`badge ${STATUS_COLORS[a.status] ?? ""}`}>{a.status}</span>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1 !px-2 !py-1 text-xs" onClick={() => act(a.id, "approve")}>
                Approve
              </button>
              <button className="btn-ghost flex-1 !px-2 !py-1 text-xs" onClick={() => act(a.id, "reject")}>
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
