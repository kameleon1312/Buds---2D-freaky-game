import { ImageResponse } from 'next/og';
import { budSvg } from '@buds/shared';
import { sampleLooks } from '@/lib/looks';

export const alt = 'Buds — znajdź swojego ziomka';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  const sprites = sampleLooks(5, 21).map(
    (look) =>
      `data:image/svg+xml;base64,${Buffer.from(budSvg(look, { width: 160 })).toString('base64')}`,
  );

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5eedc',
        color: '#1d1712',
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', gap: 36 }}>
        {sprites.map((src, i) => (
          <img key={i} src={src} width={160} height={240} alt="" />
        ))}
      </div>
      <div style={{ fontSize: 96, fontWeight: 800 }}>Buds</div>
      <div style={{ fontSize: 40, color: '#6f6455' }}>Znajdź swojego ziomka</div>
    </div>,
    size,
  );
}
