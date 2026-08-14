import { useMemo, useState } from 'react';
import { flattenGroupsForXray } from '../shared/xrayScenarios';

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
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [groups, setGroups] = useState<StickyNoteGroup[]>([]);
  const [editingNoteIds, setEditingNoteIds] = useState<Set<string>>(() => new Set());
  const [draftNoteText, setDraftNoteText] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('Idle');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testSetKey, setTestSetKey] = useState('');
  const [xrayStatus, setXrayStatus] = useState('Not exported');
  const [xrayError, setXrayError] = useState('');
  const [createdTests, setCreatedTests] = useState<CreatedXrayTest[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const xrayScenarios = useMemo(() => flattenGroupsForXray(groups), [groups]);
  const hasInvalidXrayScenario = xrayScenarios.some((scenario) => scenario.errors.length > 0);
  const canExportToXray =
    testSetKey.trim().length > 0 &&
    xrayScenarios.length > 0 &&
    !hasInvalidXrayScenario &&
    !isExporting;

  async function fetchStickyNotes() {
    setIsLoading(true);
    setError('');
    setStatus('Fetching sticky notes');

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
      setNotes(result.notes);
      setGroups(result.groups);
      setEditingNoteIds(new Set());
      setDraftNoteText({});
      setXrayError('');
      setCreatedTests([]);
      setXrayStatus('Not exported');
      setStatus(
        `${result.groupCount} ${result.groupCount === 1 ? 'group' : 'groups'} from ${result.count} blue/green sticky notes`
      );
    } catch (fetchError) {
      setNotes([]);
      setGroups([]);
      setEditingNoteIds(new Set());
      setDraftNoteText({});
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch sticky notes');
      setStatus('Fetch failed');
    } finally {
      setIsLoading(false);
    }
  }

  function updateGreenNoteText(noteId: string, plainText: string) {
    setGroups((currentGroups) =>
      currentGroups.map((group) => ({
        ...group,
        items: group.items.map((item) => (item.id === noteId ? { ...item, plainText } : item))
      }))
    );
    setNotes((currentNotes) =>
      currentNotes.map((note) => (note.id === noteId ? { ...note, plainText } : note))
    );
  }

  function startEditingNote(note: StickyNote) {
    setEditingNoteIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(note.id);
      return nextIds;
    });
    setDraftNoteText((currentDrafts) => ({ ...currentDrafts, [note.id]: note.plainText }));
  }

  function cancelEditingNote(noteId: string) {
    setEditingNoteIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(noteId);
      return nextIds;
    });
    setDraftNoteText((currentDrafts) => {
      const { [noteId]: _discardedDraft, ...remainingDrafts } = currentDrafts;
      return remainingDrafts;
    });
  }

  function saveEditingNote(noteId: string) {
    updateGreenNoteText(noteId, draftNoteText[noteId] ?? '');
    setCreatedTests([]);
    setXrayStatus('Not exported');
    cancelEditingNote(noteId);
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

      <section className="results" aria-live="polite">
        <div className="resultHeader">
          <h2>Sticky notes</h2>
          <span>{status}</span>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {groups.length > 0 ? (
          <div className="groupGrid">
            {groups.map((group) => (
              <article key={group.header.id} className="noteGroup">
                <h3>{group.header.plainText || '(empty header)'}</h3>
                {group.items.length > 0 ? (
                  <ul className="noteList">
                    {group.items.map((note) => (
                      <li key={note.id} className="noteItem">
                        {editingNoteIds.has(note.id) ? (
                          <div className="noteEditor">
                            <textarea
                              id={`note-${note.id}`}
                              aria-label="Edit sticky note text"
                              value={draftNoteText[note.id] ?? ''}
                              onChange={(event) =>
                                setDraftNoteText((currentDrafts) => ({
                                  ...currentDrafts,
                                  [note.id]: event.target.value
                                }))
                              }
                              rows={Math.max(3, (draftNoteText[note.id] ?? '').split('\n').length)}
                              autoFocus
                            />
                            <div className="noteEditActions">
                              <button
                                className="noteAction noteActionPrimary"
                                type="button"
                                onClick={() => saveEditingNote(note.id)}
                              >
                                Save
                              </button>
                              <button
                                className="noteAction"
                                type="button"
                                onClick={() => cancelEditingNote(note.id)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="noteDisplay">
                            <strong>{note.plainText || '(empty sticky note)'}</strong>
                            <button
                              className="noteAction"
                              type="button"
                              onClick={() => startEditingNote(note)}
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="emptyState">No green sticky notes in this group.</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="emptyState">
            {notes.length > 0
              ? 'No blue header groups found for the green sticky notes.'
              : 'No sticky notes loaded.'}
          </p>
        )}
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
        {xrayError ? <p className="error">{xrayError}</p> : null}

        {xrayScenarios.length > 0 ? (
          <ol className="scenarioPreview">
            {xrayScenarios.map((scenario, index) => (
              <li key={scenario.sourceId}>
                <h3>
                  {index + 1}. {scenario.summary || '(missing summary)'}
                </h3>
                {scenario.errors.length > 0 ? (
                  <p className="error">{scenario.errors.join(' ')}</p>
                ) : (
                  <pre>{scenario.gherkin}</pre>
                )}
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
