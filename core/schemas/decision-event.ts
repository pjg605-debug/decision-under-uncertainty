export type Domain = 'history' | 'business' | 'exploration' | 'science' | 'crisis';
export type EvidenceClass = 'FACT' | 'CONTEMPORARY_BELIEF' | 'STATED_RATIONALE' | 'INFERENCE';
export type DecisionQuality = 'Strong' | 'Reasonable' | 'Weak' | 'Unclear';
export type OutcomeQuality = 'Good' | 'Bad' | 'Mixed';

export interface Evidence { id: string; source_type: string; title: string; author_or_institution: string; publication_date?: string; url?: string; accessed_at?: string; evidence_class: EvidenceClass; }
export interface DecisionOption { id: string; label: string; short_description: string; upside: string; downside: string; known_tradeoffs: string[]; }
export interface NarrativeSlots { hook?: string; short_setup?: string; why_option_a_made_sense?: string; why_option_b_made_sense?: string; actual_decision_explanation?: string; outcome_story?: string; hindsight_analysis?: string; decision_principle?: string; longform_story?: string; }
export interface ScoreSet { curiosity: number; decision: number; stakes: number; mystery: number; explainability: number; evidence: number; }

export interface DecisionEvent {
  id: string; title: string; domain: Domain; subdomain: string; actor: string; actor_role: string;
  date_or_period: string; era: string; location: string; t0: string; context_summary: string;
  known_information: string[]; unknown_information: string[]; options: DecisionOption[]; actual_decision: string;
  immediate_outcome: string; long_term_outcome: string; decision_quality: DecisionQuality; outcome_quality: OutcomeQuality;
  uncertainty_factors: string[]; evidence: Evidence[]; narrative_id: string; scores: ScoreSet;
  metadata: { popularity: number; controversy_risk: number; source_disagreement: number; visualizability: number; context_compression: number; fictional_demo?: boolean; };
  progressive?: { evidence: string; prompt: string; };
}
