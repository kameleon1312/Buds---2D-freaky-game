import { ImageResponse } from 'next/og';
import { budSvg, levelFromXp, moodLabel } from '@buds/shared';
import { getBud } from '@/lib/api';
import { sampleLooks } from '@/lib/looks';

export const alt = 'Buds';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bud = await getBud(slug).catch(() => null);
  const look = bud?.look ?? sampleLooks(1)[0]!;
  const sprite = `data:image/svg+xml;base64,${Buffer.from(budSvg(look, { width: 320 })).toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        background: '#f5eedc',
        padding: 60,
        gap: 56,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 420,
          height: 510,
          background: '#d9efc9',
          border: '8px solid #1d1712',
          boxShadow: '16px 16px 0 #1d1712',
        }}
      >
        <img src={sprite} width={320} height={480} alt="" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, color: '#1d1712' }}>
        <div style={{ fontSize: 36, color: '#6f6455' }}>Buds</div>
        <div style={{ fontSize: 110, fontWeight: 800, lineHeight: 1.05 }}>
          {bud?.name ?? 'Twój Bud'}
        </div>
        {bud && (
          <div style={{ fontSize: 40 }}>
            {`${moodLabel(bud.look.mood, bud.look.gender)} · poziom ${levelFromXp(bud.xp).level}`}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            marginTop: 40,
            alignSelf: 'flex-start',
            background: '#ff5a36',
            color: '#fff',
            fontSize: 34,
            fontWeight: 700,
            padding: '14px 28px',
            border: '5px solid #1d1712',
          }}
        >
          Stwórz swojego →
        </div>
      </div>
    </div>,
    size,
  );
}
