import type { Note } from "../types";

export function isNoteInHistory(note: Pick<Note, "content">): boolean {
  return /\p{L}|\p{N}/u.test(note.content);
}

export function getNoteLabel(note: Note): string {
  const title = note.title.trim();
  if (title) return title;

  const firstLine = note.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (firstLine) {
    return firstLine.length > 42 ? `${firstLine.slice(0, 42)}…` : firstLine;
  }

  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(note.createdAt));

  return `Note sans titre · ${time}`;
}

export function getNoteTabLabel(note: Note): string {
  const title = note.title.trim();
  if (title) return title;

  const firstLine = note.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine || "Sans titre";
}

export function formatNoteTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRelativeNoteTime(value: string, now = Date.now()): string {
  const elapsedSeconds = Math.round((new Date(value).getTime() - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, "second");

  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(elapsedMinutes) < 60) return formatter.format(elapsedMinutes, "minute");

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) return formatter.format(elapsedHours, "hour");

  const elapsedDays = Math.round(elapsedHours / 24);
  if (Math.abs(elapsedDays) < 7) return formatter.format(elapsedDays, "day");

  return formatNoteTime(value);
}
