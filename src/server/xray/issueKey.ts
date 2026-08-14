const issueKeyPattern = /\b([A-Z][A-Z0-9]+-\d+)\b/i;

export function extractIssueKey(value: string): string | null {
  const match = value.trim().match(issueKeyPattern);
  return match ? match[1].toUpperCase() : null;
}

export function getProjectKeyFromIssueKey(issueKey: string): string {
  return issueKey.split('-')[0];
}
