import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Jira submission modal styles', () => {
  it('keeps the warning banner within the modal width', () => {
    const styles = readFileSync(resolve('src/client/styles.css'), 'utf8');

    expect(styles).toContain('.jiraSubmitModal .notice { width: 100%; box-sizing: border-box; }');
  });
});
