import json
import re
from pathlib import Path
import numpy as np
import pandas as pd

TAXONOMY_PATH = Path("ml/skill_taxonomy.json")
RAW_CSV = Path("data/raw/jobs.csv")
OUT_PARQUET = Path("data/processed/cleaned_jobs.parquet")


def load_taxonomy() -> tuple[dict[str, str], dict[str, str]]:
    with open(TAXONOMY_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    aliases = {k.strip().lower(): v.strip() for k, v in data.get("aliases", {}).items()}
    canonical_map: dict[str, str] = {}

    for skills in data.get("categories", {}).values():
        for skill in skills:
            canonical_map[skill.lower()] = skill

    for alias_k, alias_v in aliases.items():
        canonical_map[alias_k] = alias_v

    return aliases, canonical_map


def extract_skills(row: pd.Series, canonical_map: dict[str, str]) -> list[str]:
    found: set[str] = set()

    raw_skill = str(row.get("Skill") or "").strip().lower()
    if raw_skill and raw_skill != "nan":
        for token in re.split(r"[,;|/]+", raw_skill):
            t = token.strip()
            if t in canonical_map:
                found.add(canonical_map[t])

    desc = str(row.get("Description") or "").lower()
    if desc and desc != "nan":
        for term, canonical in canonical_map.items():
            escaped = re.escape(term)
            pattern = rf"(?<![a-z0-9_]){escaped}(?![a-z0-9_])"
            if re.search(pattern, desc):
                found.add(canonical)

    return sorted(found)


def extract_salary_mid(desc: str) -> float:
    if not isinstance(desc, str) or not desc:
        return np.nan
    matches = re.findall(r"\$\s*([\d,]+)(?:\.\d{2})?", desc)
    values = []
    for m in matches:
        try:
            num = float(m.replace(",", ""))
            if 30000 <= num <= 600000:
                values.append(num)
        except ValueError:
            continue
    return float(np.mean(values)) if values else np.nan


def extract_years_exp(desc: str) -> float:
    if not isinstance(desc, str) or not desc:
        return np.nan
    matches = re.findall(r"(\d{1,2})\+?\s*(?:years?|yrs?)", desc.lower())
    nums = [int(x) for x in matches if 1 <= int(x) <= 20]
    return float(max(nums)) if nums else np.nan


def run_preprocessing(input_csv: Path = RAW_CSV, output_parquet: Path = OUT_PARQUET) -> None:
    if not input_csv.exists():
        raise FileNotFoundError(f"Missing {input_csv}")

    df = pd.read_csv(input_csv)
    _, canonical_map = load_taxonomy()

    out = pd.DataFrame({
        "title": df["Job Title"].fillna("Unknown Role").astype(str).str.strip(),
        "company": df["Company"].fillna("Unknown Company").astype(str).str.strip(),
        "location": df["Location"].fillna("Unknown Location").astype(str).str.strip(),
        "seed_skill": df["Skill"].fillna("").astype(str).str.strip(),
        "skills": df.apply(lambda r: extract_skills(r, canonical_map), axis=1),
        "salary_mid_usd": df["Description"].apply(extract_salary_mid),
        "years_exp": df["Description"].apply(extract_years_exp),
        "description": df["Description"].fillna("").astype(str),
    })

    out = out[out["skills"].map(len) > 0].reset_index(drop=True)
    output_parquet.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(output_parquet, index=False)

    all_skills = sorted({s for lst in out["skills"] for s in lst})
    print(f"Saved {len(out)}/{len(df)} postings to {output_parquet}")
    print(f"Extracted {len(all_skills)} normalized skills: {all_skills}")
    print(f"Postings with salary parsed: {out['salary_mid_usd'].notna().sum()}")
    print(f"Postings with years_exp parsed: {out['years_exp'].notna().sum()}")


if __name__ == "__main__":
    run_preprocessing()