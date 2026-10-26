import {
  ChevronDown20Regular,
  ChevronUp20Regular,
  Dismiss20Regular,
  Search20Regular,
} from "@fluentui/react-icons";
import { useLayoutEffect, useRef } from "react";

interface FindBarProps {
  query: string;
  onChange: (query: string) => void;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function FindBar({
  query,
  onChange,
  onClose,
  onNext,
  onPrevious,
}: FindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  return (
    <div className="find-bar" role="search">
      <Search20Regular />
      <input
        ref={inputRef}
        autoFocus
        value={query}
        aria-label="Rechercher dans la note"
        placeholder="Rechercher dans la note…"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) onPrevious();
            else onNext();
          }
        }}
      />
      <button type="button" aria-label="Résultat précédent" onClick={onPrevious}>
        <ChevronUp20Regular />
      </button>
      <button type="button" aria-label="Résultat suivant" onClick={onNext}>
        <ChevronDown20Regular />
      </button>
      <button type="button" aria-label="Fermer la recherche" onClick={onClose}>
        <Dismiss20Regular />
      </button>
    </div>
  );
}
