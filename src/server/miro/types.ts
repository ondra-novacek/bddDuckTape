export interface StickyNote {
  id: string;
  content: string;
  plainText: string;
  fillColor: string | null;
  position: {
    x: number | null;
    y: number | null;
  };
}

export interface StickyNoteGroup {
  header: StickyNote;
  items: StickyNote[];
}

export interface MiroBoardItem {
  id?: unknown;
  type?: unknown;
  data?: {
    content?: unknown;
  };
  style?: {
    fillColor?: unknown;
  };
  position?: {
    x?: unknown;
    y?: unknown;
  };
}

export interface MiroItemsPage {
  data?: MiroBoardItem[];
  cursor?: string;
}
