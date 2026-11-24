import json
from pathlib import Path
import joblib
import numpy as np
from sklearn.metrics import silhouette_score

ARTIFACTS_PATH = Path("data/processed/artifacts.joblib")
REPORT_PATH = Path("data/processed/evaluation_report.json")


def evaluate() -> None:
    artifacts = joblib.load(ARTIFACTS_PATH)
    mlb = artifacts["mlb"]
    kmeans = artifacts["kmeans"]
    skills: list[str] = artifacts["skills"]
    co_stats = artifacts["co_stats"]

    labels = kmeans.labels_
    cluster_sizes = {
        f"cluster_{c['cluster_id']}": c["job_count"]
        for c in artifacts["cluster_profiles"]
    }

    co_matrix: np.ndarray = co_stats["co_matrix"]
    pmi_matrix: np.ndarray = co_stats["pmi_matrix"]
    skill_to_idx = {s: i for i, s in enumerate(skills)}

    sample_profiles = [
        ["Python"],
        ["React", "TypeScript"],
        ["Java", "Spring"],
    ]

    sample_recs = {}
    for prof in sample_profiles:
        valid = [s for s in prof if s in skill_to_idx]
        scores = []
        for idx, cand in enumerate(skills):
            if cand in valid:
                continue
            pmi_vals = [pmi_matrix[skill_to_idx[v], idx] for v in valid if co_matrix[skill_to_idx[v], idx] > 0]
            if pmi_vals:
                scores.append((cand, round(float(np.mean(pmi_vals)), 3)))
        scores.sort(key=lambda x: -x[1])
        sample_recs[", ".join(prof)] = scores[:3]

    report = {
        "total_jobs": artifacts["total_jobs"],
        "total_skills": len(skills),
        "num_clusters": len(artifacts["cluster_profiles"]),
        "cluster_distribution": cluster_sizes,
        "sample_pmi_top_3": sample_recs,
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("Evaluation saved to", REPORT_PATH)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    evaluate()