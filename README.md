# Tech Market Demand & Skill Trend Forecaster

An interactive full-stack career intelligence and skill-gap simulator built with **FastAPI**, **Scikit-learn**, **Pandas**, **React**, **TypeScript**, and **Tailwind CSS**. It normalizes tech job skill mentions into a canonical taxonomy, groups roles into market archetypes with KMeans clustering, ranks high-leverage "next-best skills" using Pointwise Mutual Information (PMI) and conditional co-occurrence, and presents everything in a responsive, gamified career quest dashboard.

---

## Key Features

* **Skill Taxonomy Normalization:** Maps raw job posting skill mentions into canonical skill categories (`Python`, `AWS`, `React`, `TypeScript`, `Spring`, `Docker`, `FastAPI`, `Pandas`, etc.) and parses experience and salary signals.
* **Role Archetype Clustering (`KMeans`):** Vectorizes multi-label skill sets with `MultiLabelBinarizer`, selects the cluster count via silhouette score, and extracts dominant skills and sample role titles per archetype.
* **PMI & Conditional Co-Occurrence Engine:** Calculates co-occurrence counts, conditional probability, and Pointwise Mutual Information (PMI) to surface relevant next skills to learn.
* **Interactive Career Quest UI:**
  * Target archetype selector cards and 1-click starter skill stacks
  * Live radial match-score gauge and readiness tiers (*New Frontier*, *Leveling Up*, *Strong Contender*, *Interview Ready*)
  * Real-time skill simulator (**+ Add / + Equip**), **🎲 Mystery Role** roulette, **⚡ Auto-Complete Quest**, XP leveling, and toggleable Web Audio sound feedback
  * Responsive layout across mobile, tablet, and desktop screens

---

## Architecture Overview

```text
[Kaggle CSV Dataset]
        │
        ▼
[01_preprocess.py] ──▶ data/processed/cleaned_jobs.parquet
        │
        ▼
[02_train_models.py] ──▶ data/processed/artifacts.joblib
        │               data/processed/market_summary.json
        ▼
[FastAPI Backend] ────▶ GET /health
        │               GET /market/overview
        │               POST /analyze/skill-gap
        ▼
[React + Vite + TS + Tailwind UI]
```

---

## Project Structure

```text
Tech-Market-Demand-Skill-Trend-Forecaster/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, and API endpoints
│   └── schemas.py               # Pydantic request and response models
├── data/
│   ├── raw/                     # Source CSV dataset
│   └── processed/
│       ├── cleaned_jobs.parquet
│       ├── artifacts.joblib
│       ├── market_summary.json
│       └── evaluation_report.json
├── frontend/
│   ├── src/
│   │   ├── api.ts               # Typed backend API client
│   │   ├── App.tsx              # Interactive dashboard & skill simulator
│   │   └── index.css            # Tailwind v4 entry & base styles
│   ├── vite.config.ts
│   └── package.json
├── ml/
│   ├── skill_taxonomy.json      # Canonical skills & alias mappings
│   ├── 01_preprocess.py         # Data cleaning & feature parsing
│   ├── 02_train_models.py       # KMeans clustering & PMI engine
│   └── 03_evaluate.py           # Clustering & recommendation evaluation
├── requirements.txt
├── .gitignore
└── README.md
```

---

## Quick Start

### 1. Backend & ML Pipeline

From the project root, create and activate a virtual environment:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Run preprocessing, model training, and evaluation:

```powershell
python ml/01_preprocess.py
python ml/02_train_models.py
python ml/03_evaluate.py
```

Start the FastAPI server on port `8000`:

```powershell
uvicorn backend.main:app --reload --port 8000
```

API docs are available at `http://127.0.0.1:8000/docs`.

---

### 2. Frontend Dashboard

In a second terminal inside `frontend/`:

```powershell
cd frontend
npm install
```

Start the dev server:

```powershell
npm run dev
```

*(If your folder path contains an `&` character on Windows and `npm run dev` triggers a `cmd.exe` path issue, run `node .\node_modules\vite\bin\vite.js` directly from `frontend/`.)*

Open `http://localhost:5173` in your browser.

---

## API Reference

* `GET /health` — Returns service status, total analyzed jobs, tracked skill count, and cluster count.
* `GET /market/overview` — Returns skill demand metrics (job count, market share %, average years of experience, average salary USD) and role cluster profiles.
* `POST /analyze/skill-gap` — Accepts `current_skills`, optional `target_cluster_id` or `target_skills`, and `top_recommendations`; returns normalized skills, matched and missing target skills, match score %, and PMI-ranked next-skill recommendations.

---

## Sample `requirements.txt`

```text
fastapi
uvicorn
pandas
pyarrow
scikit-learn
joblib
numpy
pydantic
```

---

## Sample `.gitignore`

```gitignore
venv/
.venv/
__pycache__/
*.py[cod]
frontend/node_modules/
frontend/dist/
.env
```