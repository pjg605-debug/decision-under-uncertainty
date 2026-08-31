import type { DecisionEvent, NarrativeSlots } from './schemas/decision-event';

export function transformSupabaseRows(rows: Record<string, unknown>[]): { cases: DecisionEvent[]; narratives: Record<string, NarrativeSlots> };
export function fetchApprovedContent(options: {
  url: string;
  key: string;
  fetchImpl?: typeof fetch;
}): Promise<{ cases: DecisionEvent[]; narratives: Record<string, NarrativeSlots> }>;
