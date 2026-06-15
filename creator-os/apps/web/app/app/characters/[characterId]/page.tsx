"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

type Character = {
  id: string;
  name: string;
  status: string;
  market: string;
  language: string;
  city_base: string | null;
  age_apparent: number | null;
  archetype: string | null;
  profession_strategy: string | null;
  public_bio: string | null;
  narrative_summary: string | null;
  personality_traits: string[];
};

type Pillar = {
  id: string;
  name: string;
  slug: string;
  weight_percent: number;
  description: string | null;
};

type Identity = {
  prompt_anchor: string | null;
  wardrobe_style: string | null;
  visual_aesthetic: string | null;
  negative_identity_constraints: string | null;
};

export default function CharacterProfilePage() {
  const { characterId } = useParams<{ characterId: string }>();
  const [character, setCharacter] = useState<Character | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!characterId) return;
    api<Character>(`/characters/${characterId}`).then(setCharacter);
    api<Pillar[]>(`/characters/${characterId}/pillars`).then(setPillars);
    api<Identity>(`/characters/${characterId}/identity`).then(setIdentity).catch(() => {});
  }, [characterId]);

  async function saveBio() {
    if (!character) return;
    await api(`/characters/${characterId}`, {
      method: "PATCH",
      body: JSON.stringify({ public_bio: character.public_bio }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (!character) return <p className="text-slate-500">Loading profile…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{character.name}</h1>
          <p className="text-slate-400">
            {character.archetype} · {character.city_base} · age {character.age_apparent}
          </p>
        </div>
        <span className="badge border-accent text-accent">{character.status}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="font-semibold text-white">Identity & narrative</h2>
          <p className="text-sm text-slate-300">{character.narrative_summary}</p>
          <p className="text-xs text-slate-500">{character.profession_strategy}</p>
          <div className="flex flex-wrap gap-2">
            {character.personality_traits.map((t) => (
              <span key={t} className="badge">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold text-white">Public bio</h2>
          <textarea
            className="input h-24"
            value={character.public_bio ?? ""}
            onChange={(e) => setCharacter({ ...character, public_bio: e.target.value })}
          />
          <div className="flex items-center gap-3">
            <button className="btn" onClick={saveBio}>
              Save
            </button>
            {saved && <span className="text-sm text-accent">Saved ✓</span>}
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold text-white">Content pillars</h2>
          {pillars.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-edge py-1.5">
              <span className="text-sm text-slate-200">{p.name}</span>
              <span className="badge border-accent text-accent">{Number(p.weight_percent)}%</span>
            </div>
          ))}
        </div>

        <div className="card space-y-2">
          <h2 className="font-semibold text-white">Identity lock (summary)</h2>
          <p className="text-sm text-slate-300">{identity?.prompt_anchor}</p>
          <p className="text-xs text-slate-500">Wardrobe: {identity?.wardrobe_style}</p>
          <p className="text-xs text-slate-500">Aesthetic: {identity?.visual_aesthetic}</p>
        </div>
      </div>
    </div>
  );
}
