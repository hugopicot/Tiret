export interface Note {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface WorkspaceState {
  openNoteIds: number[];
  activeNoteId: number | null;
  sidebarOpen: boolean;
}
