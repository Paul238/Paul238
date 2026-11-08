import { AlarmClock, BedDouble, Briefcase, Sunrise, Utensils, type LucideIcon } from 'lucide-react';
import type { TodayItem } from '../domain/engine';
import { toMinutes } from '../domain/nutrition';
import type { Task } from '../domain/types';
import { AttrIcon } from './icons';

export function stageIcon(task: Task): LucideIcon | null {
  const t = task.title.toLowerCase();
  if (task.kind === 'meal') return Utensils;
  if (task.kind === 'time') {
    if (t.includes('trez')) return Sunrise;
    if (t.includes('culc') || t.includes('somn')) return BedDouble;
    if (t.includes('munc') || t.includes('școal') || t.includes('scoal') || t.includes('program') || t.includes('birou')) return Briefcase;
    return AlarmClock;
  }
  return null;
}

export function StageGlyph({ task, size = 20 }: { task: Task; size?: number }) {
  const Icon = stageIcon(task);
  if (Icon) return <Icon size={size} strokeWidth={2} />;
  return <AttrIcon attr={task.attributes[0] ?? 'discipline'} size={size} />;
}

export type StageStatus = 'done' | 'missed' | 'late' | 'due' | 'todo';

export function stageStatus(item: TodayItem, nowMin: number): StageStatus {
  const t = item.task;
  if (item.completion) return item.completion.success === false ? 'missed' : 'done';
  if (item.overdue) return 'late';
  if (t.kind === 'time' && t.time && (t.timeMode ?? 'by') === 'by' && nowMin > toMinutes(t.time) + (t.tolerance ?? 0)) return 'late';
  if (t.time && nowMin > toMinutes(t.time) + 60) return 'due';
  return 'todo';
}
