const API_BASE = "http://127.0.0.1:8000";

export interface SkillMetric {
  skill: string;
  job_count: number;
  demand_share_pct: number;
  avg_years_exp: number | null;
  avg_salary_usd: number | null;
}

export interface ClusterSkillWeight {
  skill: string;
  weight: number;
}

export interface RoleCluster {
  cluster_id: number;
  job_count: number;
  top_skills: ClusterSkillWeight[];
  sample_titles: string[];
}

export interface MarketOverview {
  total_jobs: number;
  skills: SkillMetric[];
  clusters: RoleCluster[];
}

export interface RecommendedSkill {
  skill: string;
  pmi_score: number;
  conditional_prob: number;
  co_occurrence_count: number;
  reason: string;
}

export interface SkillGapResponse {
  normalized_current_skills: string[];
  target_label: string;
  target_skills: string[];
  matched_skills: string[];
  missing_skills: string[];
  match_score_pct: number;
  recommended_next_skills: RecommendedSkill[];
}

export async function fetchMarketOverview(): Promise<MarketOverview> {
  const res = await fetch(`${API_BASE}/market/overview`);
  if (!res.ok) throw new Error("Failed to load market overview");
  return res.json();
}

export async function analyzeSkillGap(payload: {
  current_skills: string[];
  target_cluster_id?: number | null;
  target_skills?: string[] | null;
  top_recommendations?: number;
}): Promise<SkillGapResponse> {
  const res = await fetch(`${API_BASE}/analyze/skill-gap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Skill gap analysis failed");
  return res.json();
}