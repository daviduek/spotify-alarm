import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 108, height: 108, borderRadius: 54, border: '7px solid #ffa033', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', width: 7, height: 42, background: '#fff', borderRadius: 4, top: 14, left: 50 }} />
        <div style={{ position: 'absolute', width: 34, height: 7, background: '#fff', borderRadius: 4, top: 50, left: 50 }} />
        <div style={{ width: 14, height: 14, borderRadius: 7, background: '#ffa033' }} />
      </div>
    </div>,
    size,
  );
}
