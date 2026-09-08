import { useState } from 'react';
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
        `/api/miro/sticky-notes?boardId=${encodeURIComponent(boardId.trim())}`
      );
      const body = (await response.json()) as StickyNotesResponse | { error?: string };

      if (!response.ok) {
        throw new Error('error' in body && body.error ? body.error : 'Failed to fetch sticky notes');
      }

      const result = body as StickyNotesResponse;
      console.log('Fetched Miro sticky notes', result.notes);
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
          <label htmlFor="boardId">Miro board ID</label>
          <div className="fetchControls">
            <input
              id="boardId"
              value={boardId}
              onChange={(event) => setBoardId(event.target.value)}
              placeholder="uXjV..."
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

        {xrayScenarios.length > 0 ? (
          <ol className="scenarioPreview">
            {xrayScenarios.map((scenario, index) => (
              <li key={scenario.sourceId}>
                <label htmlFor={`scenario-${scenario.sourceId}-summary`}>
                  Scenario {index + 1} header
                </label>
                <input
                  id={`scenario-${scenario.sourceId}-summary`}
                  aria-label={`Xray scenario ${index + 1} header`}
                  value={scenario.summary}
                  onChange={(event) =>
                    updateXrayScenario(scenario.sourceId, 'summary', event.target.value)
                  }
                  placeholder="Test summary"
                />
                <label htmlFor={`scenario-${scenario.sourceId}-gherkin`}>Gherkin</label>
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
    </main>
  );
}
