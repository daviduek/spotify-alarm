import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/** App icon: black tile, amber "wake" dot, thin clock hand. */
export default function Icon() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 96 }}>
      <div style={{ width: 300, height: 300, borderRadius: 150, border: '18px solid #ffa033', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', width: 18, height: 120, background: '#fff', borderRadius: 9, top: 40, left: 141 }} />
        <div style={{ position: 'absolute', width: 96, height: 18, background: '#fff', borderRadius: 9, top: 141, left: 141 }} />
        <div style={{ width: 36, height: 36, borderRadius: 18, background: '#ffa033' }} />
      </div>
    </div>,
    size,
  );
}
