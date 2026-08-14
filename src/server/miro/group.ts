import type { StickyNote, StickyNoteGroup } from './types';

const blueHeaderColors = new Set(['light_blue', 'blue', 'dark_blue']);
const greenItemColors = new Set(['light_green', 'green', 'dark_green']);

type PositionedStickyNote = StickyNote & { position: { x: number; y: number } };
type PositionedStickyNoteGroup = {
  header: PositionedStickyNote;
  items: PositionedStickyNote[];
};

function hasPosition(note: StickyNote): note is PositionedStickyNote {
  return typeof note.position.x === 'number' && typeof note.position.y === 'number';
}

function isBlueHeader(note: StickyNote): note is PositionedStickyNote {
  return note.fillColor !== null && blueHeaderColors.has(note.fillColor) && hasPosition(note);
}

function isGreenItem(note: StickyNote): note is PositionedStickyNote {
  return note.fillColor !== null && greenItemColors.has(note.fillColor) && hasPosition(note);
}

export function groupStickyNotes(notes: StickyNote[]): StickyNoteGroup[] {
  const headers = notes
    .filter(isBlueHeader)
    .sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y);

  const groups: PositionedStickyNoteGroup[] = headers.map((header) => ({ header, items: [] }));

  for (const item of notes.filter(isGreenItem)) {
    const nearestGroup = groups
      .filter((group) => item.position.y > group.header.position.y)
      .sort((left, right) => {
        const leftDistance = Math.abs(item.position.x - left.header.position.x);
        const rightDistance = Math.abs(item.position.x - right.header.position.x);
        return leftDistance - rightDistance || left.header.position.y - right.header.position.y;
      })[0];

    if (nearestGroup) {
      nearestGroup.items.push(item);
    }
  }

  for (const group of groups) {
    group.items.sort((left, right) => {
      return left.position.y - right.position.y;
    });
  }

  return groups;
}
