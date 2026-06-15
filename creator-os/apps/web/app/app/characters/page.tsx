"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Character = {
  id: string;
  name: string;
  status: string;
  market: string;
  city_base: string | null;
  archetype: string | null;
};

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);

  useEffect(() => {
    api<Character[]>("/characters").then(setCharacters).catch(() => setCharacters([]));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Characters</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {characters.map((c) => (
          <Link key={c.id} href={`/app/characters/${c.id}`} className="card hover:border-accent">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-white">{c.name}</span>
              <span className="badge border-accent text-accent">{c.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{c.archetype}</p>
            <p className="mt-1 text-xs text-slate-500">
              {c.city_base} · {c.market}
            </p>
          </Link>
        ))}
        {characters.length === 0 && (
          <p className="text-slate-500">No characters yet. Run the seed script.</p>
        )}
      </div>
    </div>
  );
}
