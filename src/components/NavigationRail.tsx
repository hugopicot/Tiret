import {
  Edit16Regular,
  PanelLeftExpand20Regular,
  Search16Regular,
} from "@fluentui/react-icons";

interface NavigationRailProps {
  onCreate: () => void;
  onExpand: () => void;
}

export function NavigationRail({ onCreate, onExpand }: NavigationRailProps) {
  return (
    <nav className="navigation-rail" aria-label="Navigation">
      <div className="navigation-rail__top">
        <button type="button" onClick={onExpand} aria-label="Afficher les notes">
          <PanelLeftExpand20Regular />
        </button>
        <button type="button" onClick={onCreate} aria-label="Nouvelle note">
          <Edit16Regular />
        </button>
        <button type="button" onClick={onExpand} aria-label="Rechercher dans les notes">
          <Search16Regular />
        </button>
      </div>
    </nav>
  );
}
