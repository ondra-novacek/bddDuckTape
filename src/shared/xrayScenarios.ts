export interface ParsedXrayScenario {
  sourceId: string;
  summary: string;
  gherkin: string;
  errors: string[];
}

interface StickyNoteLike {
  id: string;
  plainText: string;
}

interface StickyNoteGroupLike {
  header: StickyNoteLike;
  items: StickyNoteLike[];
}

export function parseXrayScenario(sourceId: string, plainText: string): ParsedXrayScenario {
  const lines = plainText.trim().split('\n');
  const summaryIndex = lines.findIndex((line) => line.trim().length > 0);
  const firstLine = summaryIndex >= 0 ? lines[summaryIndex].trim() : '';
  const hasSummary = !/^(given|when)/i.test(firstLine);
  const summary = hasSummary ? firstLine : '';
  const gherkin =
    summaryIndex >= 0
      ? lines
          .slice(summaryIndex + (hasSummary ? 1 : 0))
          .join('\n')
          .trim()
      : '';
  const errors: string[] = [];

  if (!summary) {
    errors.push('Add a summary on the first line.');
  }

  if (!gherkin) {
    errors.push('Add Gherkin after the summary line.');
  }

  return { sourceId, summary, gherkin, errors };
}

export function flattenGroupsForXray(groups: StickyNoteGroupLike[]): ParsedXrayScenario[] {
  return groups.flatMap((group) =>
    group.items.map((item) => parseXrayScenario(item.id, item.plainText))
  );
}
