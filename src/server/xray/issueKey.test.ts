import { describe, expect, it } from 'vitest';
import { extractIssueKey, getProjectKeyFromIssueKey } from './issueKey';

describe('extractIssueKey', () => {
  it('accepts a raw issue key', () => {
    expect(extractIssueKey('LW1-28042')).toBe('LW1-28042');
  });

  it('extracts an issue key from a Jira browse URL', () => {
    expect(extractIssueKey('https://levelworks.atlassian.net/browse/LW1-28042')).toBe(
      'LW1-28042'
    );
  });

  it('returns null for invalid input', () => {
    expect(extractIssueKey('not an issue')).toBeNull();
  });
});

describe('getProjectKeyFromIssueKey', () => {
  it('returns the project key before the issue number', () => {
    expect(getProjectKeyFromIssueKey('LW1-28042')).toBe('LW1');
  });
});
