export interface Note {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceState {
  openNoteIds: number[];
  activeNoteId: number | null;
  sidebarOpen: boolean;
}
