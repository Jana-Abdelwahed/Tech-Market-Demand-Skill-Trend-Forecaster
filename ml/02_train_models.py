import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import MultiLabelBinarizer

INPUT_PARQUET = Path("data/processed/cleaned_jobs.parquet")
ARTIFACTS_PATH = Path("data/processed/artifacts.joblib")
SUMMARY_JSON_PATH = Path("data/processed/market_summary.json")


def choose_optimal_k(X: np.ndarray, k_min: int = 2, k_max: int = 5) -> tuple[int, dict[int, float]]:
    n_samples = X.shape[0]
    upper = min(k_max, n_samples - 1)
    scores: dict[int, float] = {}
    if upper < k_min:
        return 2, scores

    best_k = k_min
    best_score = -1.0
    for k in range(k_min, upper + 1):
        model = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = model.fit_predict(X)
        if len(set(labels)) > 1:
            score = float(silhouette_score(X, labels))
            scores[k] = round(score, 4)
            if score > best_score:
                best_score = score
                best_k = k
    return best_k, scores


def build_cooccurrence_stats(df: pd.DataFrame, skills: list[str]) -> dict:
    n_jobs = len(df)
    skill_to_idx = {s: i for i, s in enumerate(skills)}
    m = len(skills)

    co_matrix = np.zeros((m, m), dtype=int)
    skill_counts = np.zeros(m, dtype=int)

    for skill_list in df["skills"]:
        idxs = [skill_to_idx[s] for s in set(skill_list) if s in skill_to_idx]
        for i in idxs:
            skill_counts[i] += 1
        for i in idxs:
            for j in idxs:
                if i != j:
                    co_matrix[i, j] += 1

    pmi_matrix = np.zeros((m, m), dtype=float)
    cond_prob_matrix = np.zeros((m, m), dtype=float)

    for i in range(m):
        if skill_counts[i] == 0:
            continue
        p_i = skill_counts[i] / n_jobs
        for j in range(m):
            if i == j or co_matrix[i, j] == 0 or skill_counts[j] == 0:
                continue
            p_j = skill_counts[j] / n_jobs
            p_ij = co_matrix[i, j] / n_jobs
            cond_prob_matrix[i, j] = p_ij / p_i
            pmi_matrix[i, j] = float(np.log2(p_ij / (p_i * p_j)))

    return {
        "skill_counts": {skills[i]: int(skill_counts[i]) for i in range(m)},
        "co_matrix": co_matrix,
        "cond_prob_matrix": cond_prob_matrix,
        "pmi_matrix": pmi_matrix,
    }


def compute_skill_metrics(df: pd.DataFrame, skills: list[str]) -> list[dict]:
    n_jobs = len(df)
    rows = []

    for skill in skills:
        mask = df["skills"].apply(lambda lst: skill in lst)
        subset = df[mask]
        count = int(mask.sum())
        share_pct = round((count / n_jobs) * 100, 1) if n_jobs else 0.0

        avg_exp = subset["years_exp"].mean()
        avg_sal = subset["salary_mid_usd"].mean()

        rows.append({
            "skill": skill,
            "job_count": count,
            "demand_share_pct": share_pct,
            "avg_years_exp": round(float(avg_exp), 1) if pd.notna(avg_exp) else None,
            "avg_salary_usd": int(round(float(avg_sal))) if pd.notna(avg_sal) else None,
        })

    rows.sort(key=lambda r: (-r["job_count"], r["skill"]))
    return rows


def build_clusters(df: pd.DataFrame, X: np.ndarray, skills: list[str], best_k: int) -> list[dict]:
    kmeans = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    clusters = kmeans.fit_predict(X)
    df = df.copy()
    df["cluster"] = clusters

    cluster_profiles = []
    for c_id in range(best_k):
        sub = df[df["cluster"] == c_id]
        centroid = kmeans.cluster_centers_[c_id]
        top_indices = np.argsort(centroid)[::-1][:6]
        top_skills = [
            {"skill": skills[idx], "weight": round(float(centroid[idx]), 2)}
            for idx in top_indices
            if centroid[idx] > 0.05
        ]
        sample_titles = sub["title"].value_counts().head(3).index.tolist()
        cluster_profiles.append({
            "cluster_id": int(c_id),
            "job_count": int(len(sub)),
            "top_skills": top_skills,
            "sample_titles": sample_titles,
        })

    cluster_profiles.sort(key=lambda c: -c["job_count"])
    return cluster_profiles, kmeans


def run_training() -> None:
    if not INPUT_PARQUET.exists():
        raise FileNotFoundError(f"Missing {INPUT_PARQUET}. Run ml/01_preprocess.py first.")

    df = pd.read_parquet(INPUT_PARQUET)
    mlb = MultiLabelBinarizer()
    X = mlb.fit_transform(df["skills"])
    skills = list(mlb.classes_)

    best_k, sil_scores = choose_optimal_k(X, k_min=2, k_max=5)
    cluster_profiles, kmeans = build_clusters(df, X, skills, best_k)
    co_stats = build_cooccurrence_stats(df, skills)
    skill_metrics = compute_skill_metrics(df, skills)

    artifacts = {
        "skills": skills,
        "mlb": mlb,
        "kmeans": kmeans,
        "cluster_profiles": cluster_profiles,
        "co_stats": co_stats,
        "skill_metrics": skill_metrics,
        "total_jobs": int(len(df)),
    }
    joblib.dump(artifacts, ARTIFACTS_PATH)

    summary = {
        "total_jobs": int(len(df)),
        "total_skills": len(skills),
        "best_k": best_k,
        "silhouette_scores": sil_scores,
        "top_skills": skill_metrics[:10],
        "clusters": cluster_profiles,
    }
    with open(SUMMARY_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"Trained on {len(df)} jobs across {len(skills)} skills.")
    print(f"Silhouette scores by k: {sil_scores} -> Selected k={best_k}")
    for c in cluster_profiles:
        names = [s["skill"] for s in c["top_skills"][:4]]
        print(f"  Cluster {c['cluster_id']} ({c['job_count']} jobs): top skills = {names}")


if __name__ == "__main__":
    run_training()