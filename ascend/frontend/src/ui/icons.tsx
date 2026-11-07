import { Brain, Briefcase, HeartPulse, House, Palette, PiggyBank, Target, Users, type LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import { ATTRIBUTE_MAP } from '../domain/attributes';
import type { AttributeKey } from '../domain/types';

const MAP: Record<AttributeKey, ComponentType<LucideProps>> = {
  health: HeartPulse,
  intellect: Brain,
  creativity: Palette,
  discipline: Target,
  finance: PiggyBank,
  social: Users,
  order: House,
  career: Briefcase,
};

export function AttrIcon({ attr, size = 16 }: { attr: AttributeKey; size?: number }) {
  const Icon = MAP[attr];
  return <Icon size={size} strokeWidth={2} />;
}

export function AttrBadge({ attr, size = 28 }: { attr: AttributeKey; size?: number }) {
  return (
    <span className="attr-icon" style={{ ['--c' as string]: ATTRIBUTE_MAP[attr].color, width: size, height: size }}>
      <AttrIcon attr={attr} size={Math.round(size * 0.55)} />
    </span>
  );
}

export function AttrTag({ attr }: { attr: AttributeKey }) {
  const a = ATTRIBUTE_MAP[attr];
  return (
    <span className="tag">
      <span className="dot" style={{ background: a.color }} />
      {a.label}
    </span>
  );
}
