import type { Note } from "../types";

export function mergeNotes(preferred: Note[], incoming: Note[]): Note[] {
  const preferredIds = new Set(preferred.map((note) => note.id));
  return [
    ...preferred,
    ...incoming.filter((note) => !preferredIds.has(note.id)),
  ];
}

export function mergeNoteIds(first: number[], second: number[]): number[] {
  return [...new Set([...first, ...second])];
}
