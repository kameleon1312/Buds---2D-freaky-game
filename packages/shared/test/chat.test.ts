import { describe, expect, it } from 'vitest';
import { CHAT_BURST, CHAT_MAX_LENGTH, chatAllowed, cleanChat } from '../src/chat';

describe('cleanChat', () => {
  it('keeps ordinary talk as it is', () => {
    for (const text of [
      'Siema, idziemy na rynek?',
      'Nigdy nie byłem w Las Palmas!',
      'Ile masz poziomów? Ja 5.',
      'Fajnie. Co robisz?',
      'Pojedziemy rowerem do parku',
      'Gram fagotem w orkiestrze',
      'Ten chórzysta śpiewa ładnie',
    ])
      expect(cleanChat(text)).toBe(text);
  });

  it('tidies spaces and cuts long messages', () => {
    expect(cleanChat('   hej    ty  ')).toBe('hej ty');
    expect(cleanChat('a'.repeat(500))).toBe('aaa');
    expect([...cleanChat('słowo '.repeat(40))!].length).toBeLessThanOrEqual(CHAT_MAX_LENGTH);
    expect(cleanChat('hej' + String.fromCodePoint(0x200b) + 'ty\nnowa linia')).toBe(
      'hej ty nowa linia',
    );
    expect(cleanChat('')).toBeNull();
    expect(cleanChat('    ')).toBeNull();
  });

  it('stars out swear words, also disguised', () => {
    for (const text of [
      'ty kurwa',
      'ty KURWA',
      'ty k.u.r.w.a',
      'ty k u r w a',
      'ty kuuurwa',
      'ty kurw4',
      'co za chój',
    ]) {
      const clean = cleanChat(text)!;
      expect(clean, text).not.toMatch(/kurw|chój|k\.u|k u r/i);
      expect(clean, text).toContain('*');
    }
    expect(cleanChat('spierdalaj stąd')).toBe('********** stąd');
    expect(cleanChat('wtf fuck this')).toBe('wtf **** this');
    expect(cleanChat('kurwa')).toBeNull(); // nothing left to say
  });

  it('never lets links, e-mails or phone numbers through', () => {
    expect(cleanChat('wbijaj na https://zla-strona.example/x teraz')).toBe('wbijaj na *** teraz');
    expect(cleanChat('wejdz na www.cos.tam')).toBe('wejdz na ***');
    expect(cleanChat('discord.gg/abc dawaj')).toBe('*** dawaj');
    expect(cleanChat('mój mail ala@poczta.pl')).toBe('mój mail ***');
    expect(cleanChat('dzwoń 600 123 456')).toBe('dzwoń ***');
    expect(cleanChat('mam 1500 monet')).toBe('mam 1500 monet');
  });
});

describe('chatAllowed', () => {
  it('lets a few messages through, then asks to slow down', () => {
    const sent: number[] = [];
    let t = 0;
    for (let i = 0; i < CHAT_BURST; i++) {
      expect(chatAllowed(sent, t, `wiadomość ${i}`)).toBe(true);
      sent.push(t);
      t += 1;
    }
    expect(chatAllowed(sent, t, 'jeszcze jedna')).toBe(false);
    expect(chatAllowed(sent, t + 10, 'po chwili')).toBe(true);
    expect(chatAllowed([5], 5.2, 'za szybko')).toBe(false);
  });

  it('turns away the same words said again', () => {
    expect(chatAllowed([0], 3, 'siema', { text: 'Siema', at: 0 })).toBe(false);
    expect(chatAllowed([0], 30, 'siema', { text: 'Siema', at: 0 })).toBe(true);
  });
});
