"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Post = {
  id: string;
  platform: string;
  status: string;
  caption: string | null;
  scheduled_at: string | null;
};

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    api<Post[]>("/posts").then(setPosts).catch(() => setPosts([]));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Posts</h1>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-edge text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Caption</th>
              <th className="px-4 py-3">Scheduled</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-edge/50">
                <td className="px-4 py-3 capitalize text-slate-200">{p.platform}</td>
                <td className="px-4 py-3">
                  <span className="badge border-accent text-accent">{p.status}</span>
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-400">{p.caption ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">
                  {p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No posts yet. Approve an asset and create a post package.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
