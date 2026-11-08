import {
  Baby,
  BookOpen,
  Brain,
  Briefcase,
  Car,
  Dumbbell,
  Heart,
  HeartPulse,
  House,
  Leaf,
  Music,
  Palette,
  PawPrint,
  PiggyBank,
  Plane,
  Sparkles,
  Star,
  Target,
  Users,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { attributeDef } from '../domain/attributes';
import type { AttributeKey } from '../domain/types';

const BUILTIN: Record<string, ComponentType<LucideProps>> = {
  health: HeartPulse,
  intellect: Brain,
  creativity: Palette,
  discipline: Target,
  finance: PiggyBank,
  social: Users,
  order: House,
  career: Briefcase,
};

/** pictogramele din care alegi pentru o latură nouă */
export const AREA_ICONS: Record<string, ComponentType<LucideProps>> = {
  star: Star,
  heart: Heart,
  dumbbell: Dumbbell,
  book: BookOpen,
  music: Music,
  leaf: Leaf,
  baby: Baby,
  paw: PawPrint,
  plane: Plane,
  car: Car,
  sparkles: Sparkles,
};

export function AttrIcon({ attr, size = 16 }: { attr: AttributeKey; size?: number }) {
  const Icon = BUILTIN[attr] ?? AREA_ICONS[attributeDef(attr).icon ?? 'star'] ?? Star;
  return <Icon size={size} strokeWidth={2} />;
}

export function AttrBadge({ attr, size = 28 }: { attr: AttributeKey; size?: number }) {
  return (
    <span className="attr-icon" style={{ ['--c' as string]: attributeDef(attr).color, width: size, height: size }}>
      <AttrIcon attr={attr} size={Math.round(size * 0.55)} />
    </span>
  );
}

export function AttrTag({ attr }: { attr: AttributeKey }) {
  const a = attributeDef(attr);
  return (
    <span className="tag">
      <span className="dot" style={{ background: a.color }} />
      {a.label}
    </span>
  );
}
