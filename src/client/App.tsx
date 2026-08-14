import { useState } from 'react';

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

export function App() {
  const [boardId, setBoardId] = useState('');
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [groups, setGroups] = useState<StickyNoteGroup[]>([]);
  const [status, setStatus] = useState('Idle');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      setStatus(
        `${result.groupCount} ${result.groupCount === 1 ? 'group' : 'groups'} from ${result.count} blue/green sticky notes`
      );
    } catch (fetchError) {
      setNotes([]);
      setGroups([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch sticky notes');
      setStatus('Fetch failed');
    } finally {
      setIsLoading(false);
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
                        <strong>{note.plainText || '(empty sticky note)'}</strong>
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
    </main>
  );
}
