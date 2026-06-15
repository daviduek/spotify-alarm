"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Idea = {
  id: string;
  title: string;
  pillar_slug: string | null;
  status: string;
  priority: number;
};

type Character = { id: string; name: string };

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [character, setCharacter] = useState<Character | null>(null);
  const [title, setTitle] = useState("");

  function load() {
    api<Idea[]>("/ideas").then(setIdeas).catch(() => setIdeas([]));
  }
  useEffect(() => {
    api<Character[]>("/characters").then((c) => setCharacter(c[0] ?? null));
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !character) return;
    await api("/ideas", {
      method: "POST",
      body: JSON.stringify({ character_id: character.id, title }),
    });
    setTitle("");
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Content Ideas</h1>
      <form onSubmit={create} className="card flex gap-3">
        <input
          className="input"
          placeholder="New idea title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn" disabled={!character}>
          Add
        </button>
      </form>
      <div className="space-y-2">
        {ideas.map((i) => (
          <div key={i.id} className="card flex items-center justify-between py-3">
            <div>
              <div className="text-slate-100">{i.title}</div>
              <div className="text-xs text-slate-500">{i.pillar_slug ?? "no pillar"}</div>
            </div>
            <span className="badge border-accent text-accent">{i.status}</span>
          </div>
        ))}
        {ideas.length === 0 && <p className="text-slate-500">No ideas yet.</p>}
      </div>
    </div>
  );
}
