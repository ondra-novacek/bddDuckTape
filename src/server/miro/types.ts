export interface StickyNote {
  id: string;
  content: string;
  plainText: string;
  position: {
    x: number | null;
    y: number | null;
  };
}

export interface MiroBoardItem {
  id?: unknown;
  type?: unknown;
  data?: {
    content?: unknown;
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
