import type { CSSProperties } from "react";
import {
  Atom, Axe, BookOpen, BookText, Briefcase, Calculator, ChefHat, Church,
  Clapperboard, Cog, Database, Dna, Dumbbell, FileText, Fish, FlaskConical,
  Flower2, Globe2, Hammer, Hand, HardHat, HeartHandshake, HeartPulse, Keyboard,
  Landmark, Languages, Laptop, Lightbulb, Map, MessageCircle, MoonStar, Music,
  Newspaper, Palette, PencilRuler, Plane, Presentation, ScrollText, Sheet,
  Sigma, Sprout, TestTubes, Trophy, UsersRound, Video, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Atom, Axe, BookOpen, BookText, Briefcase, Calculator, ChefHat, Church,
  Clapperboard, Cog, Database, Dna, Dumbbell, FileText, Fish, FlaskConical,
  Flower2, Globe2, Hammer, Hand, HardHat, HeartHandshake, HeartPulse, Keyboard,
  Landmark, Languages, Laptop, Lightbulb, Map, MessageCircle, MoonStar,
  Moon: MoonStar, Music, Newspaper, Palette, PencilRuler, Plane, Presentation,
  ScrollText, Sheet, Sigma, Sprout, TestTubes, Trophy, UsersRound, Users: UsersRound,
  Video, Wrench, Zap,
};

const colors: Record<string, string> = {
  blue: "#1976d2", indigo: "#4f46e5", green: "#159447", teal: "#0d9488",
  orange: "#ea7a19", purple: "#7c3aed", red: "#dc3c3c", amber: "#c77900",
  crimson: "#b91c1c", lime: "#65a30d", pink: "#db2777", violet: "#7c3aed",
  brown: "#8a5a33", slate: "#526782", sky: "#0284c7", gray: "#64748b",
  yellow: "#b77900", cyan: "#0891b2",
};

export type SubjectCardProps = {
  title: string;
  iconName?: string | null;
  accentColor?: string | null;
  illustrationUrl?: string | null;
  tag?: string;
  note?: string;
  selected?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
};

export function SubjectCard({
  title, iconName, accentColor = "blue", illustrationUrl, tag, note,
  selected = false, disabled = false, disabledReason, onClick,
}: SubjectCardProps) {
  const Icon = iconMap[iconName ?? ""] ?? BookOpen;
  const color = colors[accentColor ?? "blue"] ?? accentColor ?? colors.blue;
  const style = { "--subject-color": color, "--subject-tint": `${color}17` } as CSSProperties;
  const accessibleLabel = disabled && disabledReason ? `${title}. Unavailable: ${disabledReason}` : `${title}${tag ? `, ${tag}` : ""}`;

  return (
    <button
      className="subject-card"
      style={style}
      type="button"
      aria-pressed={selected}
      aria-label={accessibleLabel}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="subject-card__icon" aria-hidden="true">
        {illustrationUrl ? <img src={illustrationUrl} alt="" loading="lazy" width="30" height="30" /> : <Icon size={22} strokeWidth={2.1} />}
      </span>
      <span className="subject-card__text">
        <strong>{title}</strong>
        <span>{disabled && disabledReason ? disabledReason : note ?? tag ?? "Learning area"}</span>
      </span>
      {selected ? <span aria-hidden="true" style={{ marginLeft: "auto", color: "var(--blue)", fontWeight: 900 }}>✓</span> : null}
    </button>
  );
}
