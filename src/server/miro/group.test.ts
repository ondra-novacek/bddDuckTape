import { describe, expect, it } from 'vitest';
import { groupStickyNotes } from './group';
import type { StickyNote } from './types';

function note(
  id: string,
  plainText: string,
  fillColor: string,
  x: number,
  y: number
): StickyNote {
  return {
    id,
    content: `<p>${plainText}</p>`,
    plainText,
    fillColor,
    position: { x, y }
  };
}

describe('groupStickyNotes', () => {
  it('uses blue notes as headers and assigns green notes below to the nearest column', () => {
    const groups = groupStickyNotes([
      note('green-right-bottom', 'Then export', 'green', 210, 300),
      note('yellow-ignored', 'Ignore this', 'yellow', 0, 120),
      note('blue-right', 'Checkout', 'blue', 200, 0),
      note('green-left', 'Given cart has item', 'light_green', 10, 120),
      note('blue-left', 'Cart', 'light_blue', 0, 0),
      note('green-right-top', 'When user pays', 'dark_green', 190, 100),
      note('green-above-header', 'Ignore above', 'green', 190, -50)
    ]);

    expect(groups).toEqual([
      {
        header: note('blue-left', 'Cart', 'light_blue', 0, 0),
        items: [note('green-left', 'Given cart has item', 'light_green', 10, 120)]
      },
      {
        header: note('blue-right', 'Checkout', 'blue', 200, 0),
        items: [
          note('green-right-top', 'When user pays', 'dark_green', 190, 100),
          note('green-right-bottom', 'Then export', 'green', 210, 300)
        ]
      }
    ]);
  });
});
