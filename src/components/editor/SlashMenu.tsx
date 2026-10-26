import type { CSSProperties } from "react";
import type { SlashCommand, SlashRange } from "./slashCommands";

interface SlashMenuProps {
  commands: SlashCommand[];
  position: { left: number; top: number };
  range: SlashRange;
  selectedIndex: number;
  onSelect: (command: SlashCommand, range: SlashRange) => void;
}

export function SlashMenu({
  commands,
  position,
  range,
  selectedIndex,
  onSelect,
}: SlashMenuProps) {
  const style = {
    "--slash-left": `${position.left}px`,
    "--slash-top": `${position.top}px`,
  } as CSSProperties;

  let previousGroup = "";

  return (
    <div className="slash-menu" style={style} role="listbox" aria-label="Blocs">
      <div className="slash-menu__query">
        {range.query ? `/${range.query}` : "Choisir un bloc"}
      </div>
      <div className="slash-menu__items">
        {commands.length === 0 ? (
          <div className="slash-menu__empty">Aucune commande</div>
        ) : (
          commands.map((command, index) => {
            const showGroup = command.group !== previousGroup;
            previousGroup = command.group;

            return (
              <div key={command.id}>
                {showGroup && <div className="slash-menu__group">{command.group}</div>}
                <button
                  className={index === selectedIndex ? "is-selected" : ""}
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(command, range)}
                >
                  <span className="slash-menu__icon">{command.shortcut}</span>
                  <span className="slash-menu__copy">
                    <strong>{command.label}</strong>
                    <small>{command.description}</small>
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="slash-menu__hint">↑↓ naviguer · Entrée choisir · Échap fermer</div>
    </div>
  );
}
