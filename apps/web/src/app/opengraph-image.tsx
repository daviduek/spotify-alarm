import { ImageResponse } from 'next/og';

export const alt = 'Wake — the alarm that always rings';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 34, fontWeight: 700 }}>
        <div style={{ width: 22, height: 22, borderRadius: 11, background: '#ffa033' }} />
        Wake
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 176, fontWeight: 200, letterSpacing: -10, lineHeight: 1 }}>07:00</div>
        <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>The alarm that always rings.</div>
        <div style={{ fontSize: 30, color: '#a0a0a5' }}>Spotify, your own voice, or a simple alarm — reliability first.</div>
      </div>
      <div style={{ display: 'flex', gap: 28, fontSize: 24, color: '#a0a0a5' }}>
        <span style={{ color: '#34c759' }}>✓ Fallback sound always ready</span>
        <span style={{ color: '#34c759' }}>✓ Progressive wake-up</span>
        <span style={{ color: '#1db954' }}>● Spotify optional</span>
      </div>
    </div>,
    size,
  );
}
