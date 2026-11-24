import json
from pathlib import Path
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.schemas import RecommendedSkill, SkillGapRequest, SkillGapResponse

ARTIFACTS_PATH = Path("data/processed/artifacts.joblib")
TAXONOMY_PATH = Path("ml/skill_taxonomy.json")

app = FastAPI(
    title="Tech Market Demand & Skill Gap API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_canonical_lookup() -> dict[str, str]:
    lookup: dict[str, str] = {}
    if not TAXONOMY_PATH.exists():
        return lookup
    with open(TAXONOMY_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    for skills in data.get("categories", {}).values():
        for s in skills:
            lookup[s.lower()] = s
    for k, v in data.get("aliases", {}).items():
        lookup[k.lower()] = v
    return lookup


if not ARTIFACTS_PATH.exists():
    raise RuntimeError(f"Missing {ARTIFACTS_PATH}. Run ml/02_train_models.py first.")

ARTIFACTS = joblib.load(ARTIFACTS_PATH)
CANONICAL_LOOKUP = load_canonical_lookup()


def normalize_input_skills(raw_skills: list[str], available_skills: list[str]) -> list[str]:
    avail_lower = {s.lower(): s for s in available_skills}
    normalized: set[str] = set()
    for raw in raw_skills:
        cleaned = raw.strip().lower()
        if not cleaned:
            continue
        if cleaned in CANONICAL_LOOKUP and CANONICAL_LOOKUP[cleaned] in available_skills:
            normalized.add(CANONICAL_LOOKUP[cleaned])
        elif cleaned in avail_lower:
            normalized.add(avail_lower[cleaned])
    return sorted(normalized)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "total_jobs": ARTIFACTS["total_jobs"],
        "total_skills": len(ARTIFACTS["skills"]),
        "clusters": len(ARTIFACTS["cluster_profiles"]),
    }


@app.get("/market/overview")
def market_overview() -> dict:
    return {
        "total_jobs": ARTIFACTS["total_jobs"],
        "skills": ARTIFACTS["skill_metrics"],
        "clusters": ARTIFACTS["cluster_profiles"],
    }


@app.post("/analyze/skill-gap", response_model=SkillGapResponse)
def analyze_skill_gap(req: SkillGapRequest) -> SkillGapResponse:
    skills: list[str] = ARTIFACTS["skills"]
    skill_to_idx = {s: i for i, s in enumerate(skills)}
    co_stats = ARTIFACTS["co_stats"]
    co_matrix: np.ndarray = co_stats["co_matrix"]
    cond_prob_matrix: np.ndarray = co_stats["cond_prob_matrix"]
    pmi_matrix: np.ndarray = co_stats["pmi_matrix"]

    current = normalize_input_skills(req.current_skills, skills)
    current_set = set(current)

    if req.target_skills:
        target_list = normalize_input_skills(req.target_skills, skills)
        target_label = "Custom Target Role"
    elif req.target_cluster_id is not None:
        cluster_map = {c["cluster_id"]: c for c in ARTIFACTS["cluster_profiles"]}
        if req.target_cluster_id not in cluster_map:
            raise HTTPException(status_code=404, detail="Cluster ID not found")
        cluster = cluster_map[req.target_cluster_id]
        target_list = [item["skill"] for item in cluster["top_skills"]]
        target_label = f"Role Cluster #{cluster['cluster_id']}"
    else:
        top_cluster = ARTIFACTS["cluster_profiles"][0]
        target_list = [item["skill"] for item in top_cluster["top_skills"]]
        target_label = f"Top Market Cluster #{top_cluster['cluster_id']}"

    matched = sorted(set(target_list) & current_set)
    missing = sorted(set(target_list) - current_set)
    match_score_pct = round((len(matched) / len(target_list)) * 100, 1) if target_list else 0.0

    candidate_scores: dict[str, dict] = {}
    for cand in skills:
        if cand in current_set:
            continue
        j = skill_to_idx[cand]
        pmis = []
        probs = []
        co_total = 0
        drivers = []
        for cur in current:
            i = skill_to_idx[cur]
            if co_matrix[i, j] > 0:
                pmis.append(float(pmi_matrix[i, j]))
                probs.append(float(cond_prob_matrix[i, j]))
                co_total += int(co_matrix[i, j])
                drivers.append(cur)
        if co_total > 0:
            mean_pmi = float(np.mean(pmis))
            mean_prob = float(np.mean(probs))
            composite = mean_pmi + mean_prob
            candidate_scores[cand] = {
                "skill": cand,
                "pmi_score": round(mean_pmi, 3),
                "conditional_prob": round(mean_prob, 3),
                "co_occurrence_count": co_total,
                "composite": composite,
                "reason": f"Co-occurs with {', '.join(drivers[:3])} in {co_total} posting pair(s)",
            }

    ranked = sorted(candidate_scores.values(), key=lambda x: -x["composite"])[: req.top_recommendations]
    recs = [
        RecommendedSkill(
            skill=r["skill"],
            pmi_score=r["pmi_score"],
            conditional_prob=r["conditional_prob"],
            co_occurrence_count=r["co_occurrence_count"],
            reason=r["reason"],
        )
        for r in ranked
    ]

    return SkillGapResponse(
        normalized_current_skills=current,
        target_label=target_label,
        target_skills=target_list,
        matched_skills=matched,
        missing_skills=missing,
        match_score_pct=match_score_pct,
        recommended_next_skills=recs,
    )