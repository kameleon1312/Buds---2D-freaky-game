import { ImageResponse } from 'next/og';
import { budSvg } from '@buds/shared';
import { sampleLooks } from '@/lib/looks';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  const look = { ...sampleLooks(1, 3)[0]!, mood: 'radosny' as const };
  // head only — a full body is unreadable at favicon size
  const svg = budSvg(look, { width: 64, viewBox: '16 -2 128 128' });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return new ImageResponse(<img src={src} width={64} height={64} alt="" />, size);
}
