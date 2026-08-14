import type { MiroBoardItem, StickyNote } from './types';

const entityMap: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
};

export function stripHtmlToText(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&([a-z]+);/gi, (_match, entity: string) => entityMap[entity] ?? `&${entity};`)
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeStickyNote(item: MiroBoardItem): StickyNote | null {
  if (item.type !== 'sticky_note' || typeof item.id !== 'string') {
    return null;
  }

  const content = typeof item.data?.content === 'string' ? item.data.content : '';
  const fillColor = typeof item.style?.fillColor === 'string' ? item.style.fillColor : null;
  const x = typeof item.position?.x === 'number' ? item.position.x : null;
  const y = typeof item.position?.y === 'number' ? item.position.y : null;

  return {
    id: item.id,
    content,
    plainText: stripHtmlToText(content),
    fillColor,
    position: { x, y }
  };
}
