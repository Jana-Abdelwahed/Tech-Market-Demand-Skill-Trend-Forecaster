from pydantic import BaseModel, Field


class SkillGapRequest(BaseModel):
    current_skills: list[str] = Field(..., min_length=1, examples=[["Python", "React"]])
    target_cluster_id: int | None = Field(default=None, ge=0)
    target_skills: list[str] | None = Field(default=None)
    top_recommendations: int = Field(default=5, ge=1, le=12)


class RecommendedSkill(BaseModel):
    skill: str
    pmi_score: float
    conditional_prob: float
    co_occurrence_count: int
    reason: str


class SkillGapResponse(BaseModel):
    normalized_current_skills: list[str]
    target_label: str
    target_skills: list[str]
    matched_skills: list[str]
    missing_skills: list[str]
    match_score_pct: float
    recommended_next_skills: list[RecommendedSkill]