import { describe, expect, it } from 'vitest';
import { normalizeStickyNote, stripHtmlToText } from './normalize';

describe('stripHtmlToText', () => {
  it('converts Miro HTML content into readable plain text', () => {
    expect(stripHtmlToText('<p>Given a user<br />When they log in</p>')).toBe(
      'Given a user\nWhen they log in'
    );
  });

  it('decodes common HTML entities', () => {
    expect(stripHtmlToText('<p>Tom &amp; Jerry &lt;QA&gt;</p>')).toBe('Tom & Jerry <QA>');
  });
});

describe('normalizeStickyNote', () => {
  it('returns a normalized sticky note from a Miro board item', () => {
    expect(
      normalizeStickyNote({
        id: '345876',
        type: 'sticky_note',
        data: { content: '<p>Scenario: Login</p>' },
        style: { fillColor: 'light_green' },
        position: { x: 10, y: -20 }
      })
    ).toEqual({
      id: '345876',
      content: '<p>Scenario: Login</p>',
      plainText: 'Scenario: Login',
      fillColor: 'light_green',
      position: { x: 10, y: -20 }
    });
  });

  it('returns null for non-sticky-note items', () => {
    expect(
      normalizeStickyNote({
        id: 'shape-1',
        type: 'shape',
        data: { content: '<p>Ignore me</p>' }
      })
    ).toBeNull();
  });
});
