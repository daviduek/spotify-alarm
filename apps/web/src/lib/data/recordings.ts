import type { SupabaseClient } from '@supabase/supabase-js';

export type Recording = {
  id: string;
  name: string;
  storagePath: string;
  mimeType: string;
  durationMs: number;
  createdAt: string;
};

type Row = { id: string; name: string; storage_path: string; mime_type: string; duration_ms: number; created_at: string };
const toRecording = (r: Row): Recording => ({ id: r.id, name: r.name, storagePath: r.storage_path, mimeType: r.mime_type, durationMs: r.duration_ms, createdAt: r.created_at });

/** `audio/webm;codecs=opus` → `audio/webm` (the bucket's allow-list matches bare types). */
function bareMime(type: string): string {
  const base = (type || 'audio/webm').split(';')[0].trim().toLowerCase();
  return base || 'audio/webm';
}

export async function fetchRecordings(supabase: SupabaseClient, userId: string): Promise<Recording[]> {
  const { data, error } = await supabase.from('recordings').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Row[]).map(toRecording);
}

/** Uploads a blob to the private bucket and registers the row. Returns the recording. */
export async function uploadRecording(
  supabase: SupabaseClient,
  userId: string,
  blob: Blob,
  name: string,
  durationMs: number,
): Promise<Recording> {
  const mime = bareMime(blob.type);
  const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : mime.includes('mpeg') ? 'mp3' : 'webm';
  const id = crypto.randomUUID();
  const path = `${userId}/${id}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('recordings').upload(path, blob, { contentType: mime, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { data, error } = await supabase
    .from('recordings')
    .insert({ id, user_id: userId, name, storage_path: path, mime_type: mime, duration_ms: Math.round(durationMs) })
    .select('*')
    .single();
  if (error) {
    // Don't leave an orphan object behind.
    await supabase.storage.from('recordings').remove([path]).catch(() => undefined);
    throw new Error(error.message);
  }
  return toRecording(data as Row);
}

export async function renameRecording(supabase: SupabaseClient, userId: string, id: string, name: string): Promise<void> {
  const { error } = await supabase.from('recordings').update({ name }).eq('user_id', userId).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteRecording(supabase: SupabaseClient, userId: string, rec: Recording): Promise<void> {
  const { error: removeError } = await supabase.storage.from('recordings').remove([rec.storagePath]);
  if (removeError) console.warn('storage remove failed', removeError.message);
  const { error } = await supabase.from('recordings').delete().eq('user_id', userId).eq('id', rec.id);
  if (error) throw new Error(error.message);
}

/** Signed URL for playback (bucket is private). Cached for an hour by default. */
export async function signedUrl(supabase: SupabaseClient, storagePath: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from('recordings').createSignedUrl(storagePath, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
