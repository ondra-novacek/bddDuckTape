import { useEffect, useState } from 'react';
import { flattenGroupsForXray, type ParsedXrayScenario } from '../shared/xrayScenarios';

interface StickyNote {
  id: string;
  content: string;
  plainText: string;
  fillColor: string | null;
  position: {
    x: number | null;
    y: number | null;
  };
}

interface StickyNoteGroup {
  header: StickyNote;
  items: StickyNote[];
}

interface StickyNotesResponse {
  boardId: string;
  count: number;
  groupCount: number;
  notes: StickyNote[];
  groups: StickyNoteGroup[];
}

interface CreatedXrayTest {
  sourceId: string;
  issueId: string;
  key: string;
}

type ScenarioField = 'summary' | 'gherkin';

interface AiSuggestion {
  sourceId: string;
  field: ScenarioField;
  original: string;
  proposal?: string;
}

function extractMiroBoardId(value: string): string {
  const trimmedValue = value.trim();

  try {
    const url = new URL(trimmedValue);
    const isMiroDomain = url.hostname === 'miro.com' || url.hostname.endsWith('.miro.com');
    const boardId = isMiroDomain
      ? url.pathname.match(/^\/app\/board\/([^/]+)/)?.[1]
      : undefined;

    return boardId ? decodeURIComponent(boardId) : trimmedValue;
  } catch {
    return trimmedValue;
  }
}

export function App() {
  const [boardId, setBoardId] = useState('');
  const [xrayScenarios, setXrayScenarios] = useState<ParsedXrayScenario[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testSetKey, setTestSetKey] = useState('');
  const [xrayStatus, setXrayStatus] = useState('Not exported');
  const [xrayError, setXrayError] = useState('');
  const [createdTests, setCreatedTests] = useState<CreatedXrayTest[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiError, setAiError] = useState('');
  const [polishingField, setPolishingField] = useState<string | null>(null);

  const hasInvalidXrayScenario = xrayScenarios.some((scenario) => scenario.errors.length > 0);
  const canExportToXray =
    testSetKey.trim().length > 0 &&
    xrayScenarios.length > 0 &&
    !hasInvalidXrayScenario &&
    !isExporting;

  async function fetchStickyNotes() {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/miro/sticky-notes?boardId=${encodeURIComponent(extractMiroBoardId(boardId))}`
      );
      const body = (await response.json()) as StickyNotesResponse | { error?: string };

      if (!response.ok) {
        throw new Error('error' in body && body.error ? body.error : 'Failed to fetch sticky notes');
      }

      const result = body as StickyNotesResponse;
      console.log(
        'Fetched Miro green sticky-note plain text',
        result.groups.flatMap((group) => group.items.map((note) => note.plainText))
      );
      setXrayScenarios(flattenGroupsForXray(result.groups));
      setXrayError('');
      setCreatedTests([]);
      setXrayStatus('Not exported');
    } catch (fetchError) {
      setXrayScenarios([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch sticky notes');
    } finally {
      setIsLoading(false);
    }
  }

  function updateXrayScenario(
    sourceId: string,
    field: 'summary' | 'gherkin',
    value: string
  ) {
    setXrayScenarios((currentScenarios) =>
      currentScenarios.map((scenario) => {
        if (scenario.sourceId !== sourceId) return scenario;

        const summary = field === 'summary' ? value : scenario.summary;
        const gherkin = field === 'gherkin' ? value : scenario.gherkin;
        const errors: string[] = [];

        if (!summary.trim()) {
          errors.push('Add a summary in the header field.');
        }

        if (!gherkin.trim()) {
          errors.push('Add Gherkin in the free-form text field.');
        }

        return { ...scenario, summary, gherkin, errors };
      })
    );
    setCreatedTests([]);
    setXrayStatus('Not exported');
  }

  useEffect(() => {
    if (!aiSuggestion) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAiSuggestion(null);
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [aiSuggestion]);

  async function requestAiSuggestion(scenario: ParsedXrayScenario, field: ScenarioField) {
    const fieldId = `${scenario.sourceId}-${field}`;
    setPolishingField(fieldId);
    setAiError('');
    setAiSuggestion({ sourceId: scenario.sourceId, field, original: scenario[field] });

    try {
      const response = await fetch('/api/ai/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field,
          summary: scenario.summary,
          gherkin: scenario.gherkin
        })
      });
      const body = (await response.json()) as { proposal?: string; error?: string };
      if (!response.ok || !body.proposal) {
        throw new Error(body.error ?? 'AI could not create a suggestion.');
      }

      setAiSuggestion((currentSuggestion) =>
        currentSuggestion &&
        currentSuggestion.sourceId === scenario.sourceId &&
        currentSuggestion.field === field
          ? { ...currentSuggestion, proposal: body.proposal }
          : currentSuggestion
      );
    } catch (aiRequestError) {
      setAiError(aiRequestError instanceof Error ? aiRequestError.message : 'AI could not create a suggestion.');
      setAiSuggestion(null);
    } finally {
      setPolishingField(null);
    }
  }

  function acceptAiSuggestion() {
    if (!aiSuggestion?.proposal) return;
    updateXrayScenario(aiSuggestion.sourceId, aiSuggestion.field, aiSuggestion.proposal);
    setAiSuggestion(null);
  }

  async function createInXray() {
    setIsExporting(true);
    setXrayError('');
    setCreatedTests([]);
    setXrayStatus('Creating Xray Tests');

    try {
      const response = await fetch('/api/xray/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testSetKey: testSetKey.trim(),
          scenarios: xrayScenarios.map(({ sourceId, summary, gherkin }) => ({
            sourceId,
            summary,
            gherkin
          }))
        })
      });
      const body = (await response.json()) as
        | { created: CreatedXrayTest[]; warnings: string[] }
        | { error?: string };

      if (!response.ok) {
        throw new Error('error' in body && body.error ? body.error : 'Xray export failed');
      }

      const result = body as { created: CreatedXrayTest[]; warnings: string[] };
      setCreatedTests(result.created);
      setXrayStatus(
        `Created ${result.created.length} ${result.created.length === 1 ? 'Xray Test' : 'Xray Tests'}`
      );
    } catch (exportError) {
      setXrayError(exportError instanceof Error ? exportError.message : 'Xray export failed');
      setXrayStatus('Xray export failed');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="appShell">
      <section className="toolbar" aria-labelledby="page-title">
        <div>
          <h1 id="page-title">BDD Duck Tape</h1>
          <p>Fetch sticky notes from a Miro board.</p>
        </div>
        <form
          className="fetchForm"
          onSubmit={(event) => {
            event.preventDefault();
            void fetchStickyNotes();
          }}
        >
          <label htmlFor="boardId">Miro board ID or URL</label>
          <div className="fetchControls">
            <input
              id="boardId"
              value={boardId}
              onChange={(event) => setBoardId(event.target.value)}
              placeholder="uXjV... or https://miro.com/app/board/uXjV.../"
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Fetching...' : 'Fetch sticky notes'}
            </button>
          </div>
        </form>
      </section>

      <section className="xrayPanel" aria-labelledby="xray-title">
        <div className="resultHeader">
          <h2 id="xray-title">Xray preview</h2>
          <span>{xrayStatus}</span>
        </div>

        <div className="xrayControls">
          <label htmlFor="testSetKey">Xray Test Set key or URL</label>
          <input
            id="testSetKey"
            value={testSetKey}
            onChange={(event) => setTestSetKey(event.target.value)}
            placeholder="LW1-28042"
          />

          <button type="button" disabled={!canExportToXray} onClick={() => void createInXray()}>
            {isExporting ? 'Creating...' : 'Create in Xray'}
          </button>
        </div>

        <p className="warning">Create-only export: running this again creates duplicate Xray Tests.</p>
        {error ? <p className="error">{error}</p> : null}
        {xrayError ? <p className="error">{xrayError}</p> : null}
        {aiError ? <p className="error">{aiError}</p> : null}

        {xrayScenarios.length > 0 ? (
          <ol className="scenarioPreview">
            {xrayScenarios.map((scenario, index) => (
              <li key={scenario.sourceId}>
                <label htmlFor={`scenario-${scenario.sourceId}-summary`}>
                  Scenario {index + 1} header
                </label>
                <div className="fieldWithAiAction">
                  <input
                    id={`scenario-${scenario.sourceId}-summary`}
                    aria-label={`Xray scenario ${index + 1} header`}
                    value={scenario.summary}
                    onChange={(event) =>
                      updateXrayScenario(scenario.sourceId, 'summary', event.target.value)
                    }
                    placeholder="Test summary"
                  />
                  <button
                    type="button"
                    className="aiAction"
                    aria-label={`Polish summary for scenario ${index + 1}`}
                    title="Polish summary with AI"
                    disabled={polishingField === `${scenario.sourceId}-summary`}
                    onClick={() => void requestAiSuggestion(scenario, 'summary')}
                  >
                    ✨
                  </button>
                </div>
                <label htmlFor={`scenario-${scenario.sourceId}-gherkin`}>Gherkin</label>
                <div className="fieldWithAiAction">
                  <textarea
                    id={`scenario-${scenario.sourceId}-gherkin`}
                    aria-label={`Xray scenario ${index + 1} Gherkin`}
                    value={scenario.gherkin}
                    onChange={(event) =>
                      updateXrayScenario(scenario.sourceId, 'gherkin', event.target.value)
                    }
                    rows={Math.max(4, scenario.gherkin.split('\n').length)}
                    placeholder="Feature, Scenario, Given, When, Then..."
                  />
                  <button
                    type="button"
                    className="aiAction"
                    aria-label={`Polish Gherkin for scenario ${index + 1}`}
                    title="Polish Gherkin with AI"
                    disabled={polishingField === `${scenario.sourceId}-gherkin`}
                    onClick={() => void requestAiSuggestion(scenario, 'gherkin')}
                  >
                    ✨
                  </button>
                </div>
                {scenario.errors.length > 0 ? (
                  <p className="error">{scenario.errors.join(' ')}</p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="emptyState">Load green sticky notes to preview Xray scenarios.</p>
        )}

        {createdTests.length > 0 ? (
          <ul className="createdTests">
            {createdTests.map((test) => (
              <li key={test.issueId}>{test.key}</li>
            ))}
          </ul>
        ) : null}
      </section>
      {aiSuggestion ? (
        <div className="modalBackdrop" role="presentation">
          <section className="aiReviewModal" role="dialog" aria-modal="true" aria-labelledby="ai-review-title">
            <div className="modalHeader">
              <h2 id="ai-review-title">Review AI suggestion</h2>
              <button type="button" className="closeModal" aria-label="Discard AI suggestion" onClick={() => setAiSuggestion(null)}>
                ×
              </button>
            </div>
            {aiSuggestion.proposal ? (
              <>
                <p>Review the proposed {aiSuggestion.field === 'summary' ? 'summary' : 'Gherkin'} change before applying it.</p>
                <UnifiedDiff original={aiSuggestion.original} proposal={aiSuggestion.proposal} />
                <div className="modalActions">
                  <button type="button" className="secondaryButton" onClick={() => setAiSuggestion(null)}>
                    Discard
                  </button>
                  <button type="button" onClick={acceptAiSuggestion}>Accept changes</button>
                </div>
              </>
            ) : (
              <div className="loadingSuggestion" role="status">
                <span className="loadingSpinner" aria-hidden="true" />
                Creating suggestion…
              </div>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}

type DiffLineState = 'unchanged' | 'removed' | 'added';

interface DiffLine {
  content: string;
  state: DiffLineState;
  lineNumber: number;
}

function UnifiedDiff({ original, proposal }: { original: string; proposal: string }) {
  const lines = createLineDiff(original, proposal);

  return (
    <section className="unifiedDiff" aria-label="Suggested changes">
      <h3>Changes</h3>
      <div className="diffLines">
        {lines.map((line, index) => (
          <p className={`diffLine diff${capitalize(line.state)}`} key={`diff-${index}`}>
            <span className="lineNumber" aria-label={`Diff line ${line.lineNumber}`}>
              {line.lineNumber}
            </span>
            <span className="diffMarker" aria-hidden="true">
              {line.state === 'removed' ? '−' : line.state === 'added' ? '+' : ' '}
            </span>
            <span>{line.content}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

function createLineDiff(original: string, proposal: string) {
  const current = original.split('\n');
  const proposed = proposal.split('\n');
  const longestCommonSubsequence = Array.from({ length: current.length + 1 }, () =>
    Array<number>(proposed.length + 1).fill(0)
  );

  for (let currentIndex = current.length - 1; currentIndex >= 0; currentIndex -= 1) {
    for (let proposedIndex = proposed.length - 1; proposedIndex >= 0; proposedIndex -= 1) {
      longestCommonSubsequence[currentIndex][proposedIndex] =
        current[currentIndex] === proposed[proposedIndex]
          ? longestCommonSubsequence[currentIndex + 1][proposedIndex + 1] + 1
          : Math.max(
              longestCommonSubsequence[currentIndex + 1][proposedIndex],
              longestCommonSubsequence[currentIndex][proposedIndex + 1]
            );
    }
  }

  const lines: DiffLine[] = [];
  let currentIndex = 0;
  let proposedIndex = 0;

  while (currentIndex < current.length || proposedIndex < proposed.length) {
    if (current[currentIndex] === proposed[proposedIndex]) {
      lines.push({ content: current[currentIndex], state: 'unchanged', lineNumber: proposedIndex + 1 });
      currentIndex += 1;
      proposedIndex += 1;
    } else if (
      currentIndex < current.length &&
      proposedIndex < proposed.length &&
      longestCommonSubsequence[currentIndex + 1][proposedIndex] ===
        longestCommonSubsequence[currentIndex][proposedIndex + 1]
    ) {
      lines.push({ content: current[currentIndex], state: 'removed', lineNumber: currentIndex + 1 });
      lines.push({ content: proposed[proposedIndex], state: 'added', lineNumber: proposedIndex + 1 });
      currentIndex += 1;
      proposedIndex += 1;
    } else if (
      currentIndex < current.length &&
      (proposedIndex === proposed.length ||
        longestCommonSubsequence[currentIndex + 1][proposedIndex] >=
          longestCommonSubsequence[currentIndex][proposedIndex + 1])
    ) {
      lines.push({ content: current[currentIndex], state: 'removed', lineNumber: currentIndex + 1 });
      currentIndex += 1;
    } else {
      lines.push({ content: proposed[proposedIndex], state: 'added', lineNumber: proposedIndex + 1 });
      proposedIndex += 1;
    }
  }

  return lines;
}

function capitalize(value: string) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}
