'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { WAKE_SOUNDS } from '@wake/domain';

import { deleteRecording, fetchRecordings, renameRecording, signedUrl, uploadRecording, type Recording } from '../lib/data/recordings';
import { WebAudioEngine } from '../lib/engine/webAudio';
import { soundUrl } from '../lib/sounds';
import { getSupabaseBrowserClient } from '../lib/supabase/client';

function fmt(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function RecordingsPanel({ userId }: { userId: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const audio = useMemo(() => new WebAudioEngine(), []);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState<{ blob: Blob; durationMs: number } | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => void fetchRecordings(supabase, userId).then(setRecordings).catch(() => undefined);
  useEffect(() => {
    load();
    return () => audio.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        setPending({ blob, durationMs: Date.now() - startedRef.current });
        setName(`Wake-up ${new Date().toLocaleDateString()}`);
      };
      recorderRef.current = rec;
      startedRef.current = Date.now();
      rec.start();
      setRecording(true);
      timerRef.current = setInterval(() => setElapsed(Date.now() - startedRef.current), 200);
    } catch {
      setError('Microphone permission is needed to record.');
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const save = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await uploadRecording(supabase, userId, pending.blob, name.trim() || 'My recording', pending.durationMs);
      setPending(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const play = async (rec: Recording) => {
    const url = await signedUrl(supabase, rec.storagePath);
    if (url) await audio.preview(url, false, 1);
  };

  const rename = async (rec: Recording) => {
    const next = prompt('Rename recording', rec.name);
    if (next) {
      await renameRecording(supabase, userId, rec.id, next);
      load();
    }
  };

  const remove = async (rec: Recording) => {
    if (!confirm(`Delete “${rec.name}”?`)) return;
    audio.stop();
    await deleteRecording(supabase, userId, rec);
    load();
  };

  return (
    <main>
      <h1 style={{ fontSize: 22 }}>Sounds &amp; recordings</h1>

      <div className="section">
        <h2>My recording</h2>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 44, fontWeight: 200 }}>{fmt(recording ? elapsed : pending?.durationMs ?? 0)}</div>
          <p className="sub">{recording ? '● Recording' : pending ? 'Ready to save' : 'Record your own wake-up message'}</p>
          {recording ? (
            <button className="btn btn-danger" onClick={stop}>Stop</button>
          ) : pending ? (
            <div className="stack" style={{ maxWidth: 320, margin: '0 auto' }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ minHeight: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', padding: '0 12px' }} />
              <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              <button className="btn btn-ghost" onClick={() => setPending(null)}>Discard</button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => void start()}>+ Record a new wake-up</button>
          )}
        </div>
      </div>
      {error ? <p className="alert error" style={{ marginTop: 12 }}>{error}</p> : null}

      <div className="section">
        <h2>Saved recordings</h2>
        {recordings.length === 0 ? (
          <div className="list-row"><span className="value">Nothing yet.</span></div>
        ) : (
          recordings.map((r) => (
            <div key={r.id} className="list-row">
              <button className="btn btn-ghost" onClick={() => void play(r)} aria-label={`Play ${r.name}`}>▶ {r.name}</button>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="value">{fmt(r.durationMs)}</span>
                <button className="chip" onClick={() => void rename(r)}>Rename</button>
                <button className="chip" onClick={() => void remove(r)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="section">
        <h2>Wake sounds</h2>
        {WAKE_SOUNDS.map((s) => (
          <div key={s.id} className="list-row">
            <span className="label">{s.name}</span>
            <button className="chip" onClick={() => void audio.preview(soundUrl(s.id), false, 1)}>Preview</button>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={() => audio.stop()}>Stop preview</button>
    </main>
  );
}
