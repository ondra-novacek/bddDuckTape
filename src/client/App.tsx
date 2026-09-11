import { useEffect, useRef, useState } from 'react';
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
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiError, setAiError] = useState('');
  const [polishingField, setPolishingField] = useState<string | null>(null);
  const [scenarioToFocus, setScenarioToFocus] = useState<string | null>(null);
  const nextManualScenarioId = useRef(0);

  const hasInvalidXrayScenario = xrayScenarios.some((scenario) => scenario.errors.length > 0);
  const canSubmitToJira = xrayScenarios.length > 0 && !hasInvalidXrayScenario && !isExporting;

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

  function deleteXrayScenario(sourceId: string) {
    setXrayScenarios((currentScenarios) =>
      currentScenarios.filter((scenario) => scenario.sourceId !== sourceId)
    );
    setCreatedTests([]);
    setXrayStatus('Not exported');
  }

  function moveXrayScenario(sourceId: string, direction: -1 | 1) {
    setXrayScenarios((currentScenarios) => {
      const currentIndex = currentScenarios.findIndex((scenario) => scenario.sourceId === sourceId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentScenarios.length) {
        return currentScenarios;
      }

      const reorderedScenarios = [...currentScenarios];
      [reorderedScenarios[currentIndex], reorderedScenarios[nextIndex]] = [
        reorderedScenarios[nextIndex],
        reorderedScenarios[currentIndex]
      ];
      return reorderedScenarios;
    });
    setCreatedTests([]);
    setXrayStatus('Not exported');
  }

  function addXrayScenario() {
    const sourceId = `manual-${Date.now()}-${nextManualScenarioId.current++}`;
    setXrayScenarios((currentScenarios) => [
      ...currentScenarios,
      {
        sourceId,
        summary: '',
        gherkin: '',
        errors: ['Add a summary in the header field.', 'Add Gherkin in the free-form text field.']
      }
    ]);
    setScenarioToFocus(sourceId);
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

  useEffect(() => {
    if (!scenarioToFocus) return;

    document.getElementById(`scenario-${scenarioToFocus}-summary`)?.focus();
    setScenarioToFocus(null);
  }, [scenarioToFocus, xrayScenarios]);

  useEffect(() => {
    function updateBackToTopVisibility() {
      setShowBackToTop(window.scrollY > 320);
    }

    window.addEventListener('scroll', updateBackToTopVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateBackToTopVisibility);
  }, []);

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
    if (!testSetKey.trim()) {
      setXrayError('Enter an Xray Test Set key or URL before submitting.');
      return;
    }

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
      setIsJiraModalOpen(false);
    } catch (exportError) {
      setXrayError(exportError instanceof Error ? exportError.message : 'Xray export failed');
      setXrayStatus('Xray export failed');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="appShell">
      <section className="toolbar" aria-label="Miro board">
        <form
          className="fetchForm"
          onSubmit={(event) => {
            event.preventDefault();
            void fetchStickyNotes();
          }}
        >
          <div className="fetchControls">
            <input
              id="boardId"
              aria-label="Miro board ID or URL"
              value={boardId}
              onChange={(event) => setBoardId(event.target.value)}
              placeholder="Board URL"
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Fetching...' : 'Fetch notes'}
            </button>
          </div>
          {error ? <p className="notice noticeError" role="alert">{error}</p> : null}
        </form>
      </section>

      {xrayScenarios.length > 0 ? (
        <section className="xrayPanel" aria-label="Xray scenarios">
          <div className="previewActions">
            {createdTests.length > 0 ? <p className="exportSuccess">{xrayStatus}</p> : null}
            <button
              type="button"
              disabled={!canSubmitToJira}
              onClick={() => {
                setXrayError('');
                setIsJiraModalOpen(true);
              }}
            >
              Submit to Jira
            </button>
          </div>
          <ol className="scenarioPreview">
            {xrayScenarios.map((scenario, index) => (
              <li key={scenario.sourceId} className="scenarioCard">
                <div className="scenarioHeader">
                  <label htmlFor={`scenario-${scenario.sourceId}-summary`}>
                    <span className="scenarioIndex" aria-hidden="true">{index + 1}</span>
                    <span>Scenario header</span>
                  </label>
                  <div className="scenarioActions">
                    <button
                      type="button"
                      className="scenarioAction"
                      aria-label={`Move scenario ${index + 1} up`}
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => moveXrayScenario(scenario.sourceId, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="scenarioAction"
                      aria-label={`Move scenario ${index + 1} down`}
                      title="Move down"
                      disabled={index === xrayScenarios.length - 1}
                      onClick={() => moveXrayScenario(scenario.sourceId, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="scenarioAction deleteScenarioAction"
                    aria-label={`Delete scenario ${index + 1}`}
                    title="Delete scenario"
                    onClick={() => deleteXrayScenario(scenario.sourceId)}
                  >
                      <span className="deleteScenarioGlyph">×</span>
                    </button>
                  </div>
                </div>
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
                  <p className="notice noticeError fieldNotice">{scenario.errors.join(' ')}</p>
                ) : null}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="scenarioAction addScenarioAction"
            aria-label="Add scenario"
            title="Add scenario"
            onClick={addXrayScenario}
          >
            +
          </button>
          {aiError ? <p className="notice noticeError" role="alert">{aiError}</p> : null}

          {createdTests.length > 0 ? (
            <ul className="createdTests">
              {createdTests.map((test) => (
                <li key={test.issueId}>{test.key}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {isJiraModalOpen ? (
        <div className="modalBackdrop" role="presentation">
          <section className="jiraSubmitModal" role="dialog" aria-modal="true" aria-labelledby="jira-submit-title">
            <div className="modalHeader">
              <h2 id="jira-submit-title">Submit to Jira</h2>
              <button type="button" className="closeModal" aria-label="Close Jira submission" onClick={() => setIsJiraModalOpen(false)}>
                ×
              </button>
            </div>
            <p className="notice noticeWarning">Create-only export: running this again creates duplicate Xray Tests.</p>
            <label htmlFor="testSetKey">Xray Test Set key or URL</label>
            <input
              id="testSetKey"
              value={testSetKey}
              onChange={(event) => setTestSetKey(event.target.value)}
              placeholder="LW1-28042"
            />
            {xrayError ? <p className="notice noticeError" role="alert">{xrayError}</p> : null}
            <div className="modalActions">
              <button type="button" className="secondaryButton" onClick={() => setIsJiraModalOpen(false)}>
                Cancel
              </button>
              <button type="button" disabled={isExporting} onClick={() => void createInXray()}>
                {isExporting ? 'Submitting...' : 'Submit tests'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
      {showBackToTop ? (
        <button
          type="button"
          className="backToTop"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ↑
        </button>
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
