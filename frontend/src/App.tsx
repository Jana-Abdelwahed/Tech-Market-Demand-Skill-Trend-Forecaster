import { useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeSkillGap,
  fetchMarketOverview,
  type MarketOverview,
  type SkillGapResponse,
} from "./api";

const CLUSTER_THEMES = [
  {
    name: "Cloud & Python Architect",
    emoji: "☁️",
    tagline: "Scalable cloud infra & backend services",
    activeClass:
      "from-sky-500/25 via-indigo-500/15 to-slate-900 border-sky-400 ring-2 ring-sky-400/50 shadow-lg shadow-sky-500/10",
    pillClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  {
    name: "Enterprise Backend & APIs",
    emoji: "⚙️",
    tagline: "High-throughput Java, Spring & REST ecosystems",
    activeClass:
      "from-violet-500/25 via-fuchsia-500/15 to-slate-900 border-violet-400 ring-2 ring-violet-400/50 shadow-lg shadow-violet-500/10",
    pillClass: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  },
  {
    name: "Modern Frontend & Full-Stack",
    emoji: "🎨",
    tagline: "Interactive TypeScript, React & Node web apps",
    activeClass:
      "from-emerald-500/25 via-teal-500/15 to-slate-900 border-emerald-400 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-500/10",
    pillClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  {
    name: "Data & Automation Specialist",
    emoji: "📊",
    tagline: "Analytics pipelines, scripting & BI dashboards",
    activeClass:
      "from-amber-500/25 via-orange-500/15 to-slate-900 border-amber-400 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/10",
    pillClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
];

const QUICK_PRESETS = [
  { label: "🐍 Python + Cloud", skills: ["Python", "AWS", "Docker"] },
  { label: "⚛️ React + TS", skills: ["React", "TypeScript", "JavaScript", "Node.js"] },
  { label: "☕ Java Spring", skills: ["Java", "Spring", "REST API"] },
  { label: "🤖 AI / Data", skills: ["Python", "Pandas", "NumPy", "FastAPI"] },
];

function getReadinessTier(score: number) {
  if (score >= 80) {
    return {
      label: "🚀 Interview Ready",
      color: "text-emerald-400",
      stroke: "#34d399",
      bg: "bg-emerald-500/15 border-emerald-500/40",
    };
  }
  if (score >= 50) {
    return {
      label: "⚡ Strong Contender",
      color: "text-sky-400",
      stroke: "#38bdf8",
      bg: "bg-sky-500/15 border-sky-500/40",
    };
  }
  if (score >= 25) {
    return {
      label: "🌱 Leveling Up",
      color: "text-amber-400",
      stroke: "#fbbf24",
      bg: "bg-amber-500/15 border-amber-500/40",
    };
  }
  return {
    label: "🧭 New Frontier",
    color: "text-rose-400",
    stroke: "#fb7185",
    bg: "bg-rose-500/15 border-rose-500/40",
  };
}

function getDeveloperLevel(skillCount: number) {
  const xp = skillCount * 150;
  const level = Math.max(1, Math.floor(xp / 450) + 1);
  const nextLevelXp = level * 450;
  const currentTierStart = (level - 1) * 450;
  const progressPct = Math.min(
    100,
    Math.round(((xp - currentTierStart) / (nextLevelXp - currentTierStart)) * 100)
  );

  const titles = [
    "Code Explorer",
    "Stack Builder",
    "Full-Stack Ranger",
    "Cloud Vanguard",
    "Principal Architect",
  ];
  const title = titles[Math.min(level - 1, titles.length - 1)];
  return { xp, level, title, progressPct };
}

function playPopTone(freq = 520, duration = 0.09) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.35, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
  }
}

export default function App() {
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSkills, setSelectedSkills] = useState<string[]>(["Python", "React"]);
  const [skillFilter, setSkillFilter] = useState("");
  const [customSkillInput, setCustomSkillInput] = useState("");
  const [targetClusterId, setTargetClusterId] = useState<number>(3);
  const [gapResult, setGapResult] = useState<SkillGapResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [soundOn, setSoundOn] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  const [lastUnlocked, setLastUnlocked] = useState<string | null>(null);
  const prevScoreRef = useRef<number>(0);

  useEffect(() => {
    fetchMarketOverview()
      .then((data) => {
        setOverview(data);
        if (data.clusters.length > 0) {
          setTargetClusterId(data.clusters[0].cluster_id);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingOverview(false));
  }, []);

  useEffect(() => {
    if (!overview || selectedSkills.length === 0) {
      setGapResult(null);
      prevScoreRef.current = 0;
      return;
    }
    let cancelled = false;
    setAnalyzing(true);
    analyzeSkillGap({
      current_skills: selectedSkills,
      target_cluster_id: targetClusterId,
      top_recommendations: 4,
    })
      .then((res) => {
        if (!cancelled) {
          setGapResult(res);
          setError(null);
          if (res.match_score_pct >= 80 && prevScoreRef.current < 80) {
            setCelebrate(true);
            if (soundOn) playPopTone(660, 0.22);
            setTimeout(() => setCelebrate(false), 2400);
          }
          prevScoreRef.current = res.match_score_pct;
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Analysis failed");
        }
      })
      .finally(() => {
        if (!cancelled) setAnalyzing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [overview, selectedSkills, targetClusterId, soundOn]);

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) => {
      const exists = prev.includes(skill);
      if (soundOn) playPopTone(exists ? 340 : 560, 0.08);
      if (!exists) {
        setLastUnlocked(skill);
        setTimeout(() => setLastUnlocked(null), 1400);
      }
      return exists ? prev.filter((s) => s !== skill) : [...prev, skill];
    });
  };

  const addSkill = (skill: string) => {
    const cleaned = skill.trim();
    if (!cleaned) return;
    setSelectedSkills((prev) => {
      if (prev.includes(cleaned)) return prev;
      if (soundOn) playPopTone(600, 0.09);
      setLastUnlocked(cleaned);
      setTimeout(() => setLastUnlocked(null), 1400);
      return [...prev, cleaned];
    });
  };

  const handleAddCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    addSkill(customSkillInput);
    setCustomSkillInput("");
  };

  const handleSpinCareer = () => {
    if (!overview || overview.clusters.length === 0) return;
    const randomCluster =
      overview.clusters[Math.floor(Math.random() * overview.clusters.length)];
    const randomPreset =
      QUICK_PRESETS[Math.floor(Math.random() * QUICK_PRESETS.length)];
    setTargetClusterId(randomCluster.cluster_id);
    setSelectedSkills(randomPreset.skills);
    if (soundOn) playPopTone(580, 0.14);
  };

  const handleCompleteQuest = () => {
    if (!gapResult || gapResult.missing_skills.length === 0) return;
    setSelectedSkills((prev) =>
      Array.from(new Set([...prev, ...gapResult.missing_skills]))
    );
    if (soundOn) playPopTone(720, 0.18);
  };

  const filteredSkills = useMemo(() => {
    if (!overview) return [];
    const q = skillFilter.trim().toLowerCase();
    if (!q) return overview.skills;
    return overview.skills.filter((s) => s.skill.toLowerCase().includes(q));
  }, [overview, skillFilter]);

  if (loadingOverview) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-2 p-4">
        <div className="w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
        <p className="text-slate-400 text-xs">Loading market intelligence...</p>
      </div>
    );
  }

  const tier = gapResult ? getReadinessTier(gapResult.match_score_pct) : null;
  const devRank = getDeveloperLevel(selectedSkills.length);
  const perSkillBoost =
    gapResult && gapResult.target_skills.length > 0
      ? Math.round(100 / gapResult.target_skills.length)
      : 0;

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = gapResult
    ? circumference - (gapResult.match_score_pct / 100) * circumference
    : circumference;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-950 text-slate-100 relative">
      {celebrate && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-2xl animate-bounce">
          🎉 Quest Complete! You reached Interview Ready status!
        </div>
      )}

      {lastUnlocked && !celebrate && (
        <div className="fixed bottom-4 right-4 z-40 px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-400/60 text-emerald-300 text-xs font-semibold shadow-lg">
          ✨ +150 XP · Unlocked <span className="text-white">{lastUnlocked}</span>
        </div>
      )}

      <div className="w-full px-3 sm:px-5 py-3 space-y-3.5">
        <header className="w-full rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/50 px-4 py-2.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                ⚡ Live ML Career Quest
              </span>
              <span className="text-[11px] font-semibold text-amber-300">
                🏆 Lv.{devRank.level} {devRank.title} ({devRank.xp} XP)
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white">
              Tech Market Demand &amp; Skill Trend Forecaster
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="hidden sm:flex flex-col justify-center bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 min-w-[140px]">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Level Progress</span>
                <span className="text-amber-400 font-bold">{devRank.progressPct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${devRank.progressPct}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSpinCareer}
              className="px-3 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-sky-500 hover:from-violet-500 hover:to-sky-400 text-white font-bold text-xs shadow transition cursor-pointer"
            >
              🎲 Mystery Role
            </button>

            <button
              type="button"
              onClick={() => setSoundOn((s) => !s)}
              title="Toggle sound effects"
              className="px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs cursor-pointer"
            >
              {soundOn ? "🔊" : "🔇"}
            </button>

            {overview && (
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1 text-center">
                  <div className="text-sm font-bold text-sky-400 leading-none">
                    {overview.total_jobs}
                  </div>
                  <div className="text-[9px] uppercase text-slate-400 mt-0.5">Roles</div>
                </div>
                <div className="rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1 text-center">
                  <div className="text-sm font-bold text-emerald-400 leading-none">
                    {overview.skills.length}
                  </div>
                  <div className="text-[9px] uppercase text-slate-400 mt-0.5">Skills</div>
                </div>
                <div className="rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1 text-center">
                  <div className="text-sm font-bold text-amber-400 leading-none">
                    {overview.clusters.length}
                  </div>
                  <div className="text-[9px] uppercase text-slate-400 mt-0.5">Paths</div>
                </div>
              </div>
            )}
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-rose-200 text-xs">
            {error}
          </div>
        )}

        {overview && (
          <>
            <section className="w-full space-y-1.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs sm:text-sm font-bold text-white">
                  1. Pick Your Career Quest Path
                </h2>
                <span className="text-[11px] text-slate-400">
                  Click any archetype to switch target
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                {overview.clusters.map((cluster, idx) => {
                  const theme = CLUSTER_THEMES[idx % CLUSTER_THEMES.length];
                  const isSelected = targetClusterId === cluster.cluster_id;
                  return (
                    <button
                      type="button"
                      key={cluster.cluster_id}
                      onClick={() => {
                        setTargetClusterId(cluster.cluster_id);
                        if (soundOn) playPopTone(460, 0.07);
                      }}
                      className={`min-w-0 w-full text-left rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? `bg-gradient-to-br ${theme.activeClass} -translate-y-0.5`
                          : "bg-slate-900/75 border-slate-800 hover:border-slate-700 hover:-translate-y-0.5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white truncate">
                          {theme.emoji} {theme.name}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-950/90 text-slate-300 border border-slate-800 shrink-0">
                          {cluster.job_count} jobs
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {theme.tagline}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {cluster.top_skills.slice(0, 4).map((ts) => (
                          <span
                            key={ts.skill}
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${theme.pillClass}`}
                          >
                            {ts.skill} {Math.round(ts.weight * 100)}%
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
              <div className="min-w-0 lg:col-span-6 rounded-xl border border-slate-800 bg-slate-900/85 p-3.5 flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs sm:text-sm font-bold text-white">
                      2. Skill Inventory ({selectedSkills.length} equipped)
                    </h2>
                    {selectedSkills.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedSkills([])}
                        className="text-[11px] text-slate-400 hover:text-rose-300 cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setSelectedSkills(preset.skills);
                          if (soundOn) playPopTone(520, 0.08);
                        }}
                        className="text-[11px] px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 transition cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <form onSubmit={handleAddCustomSkill} className="flex gap-1.5 min-w-0">
                      <input
                        type="text"
                        value={customSkillInput}
                        onChange={(e) => setCustomSkillInput(e.target.value)}
                        placeholder="Unlock custom skill..."
                        className="min-w-0 flex-1 rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs shrink-0 cursor-pointer"
                      >
                        + Add
                      </button>
                    </form>

                    <input
                      type="text"
                      value={skillFilter}
                      onChange={(e) => setSkillFilter(e.target.value)}
                      placeholder="Filter 32 skills..."
                      className="min-w-0 w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {filteredSkills.map((s) => {
                    const active = selectedSkills.includes(s.skill);
                    return (
                      <button
                        key={s.skill}
                        type="button"
                        onClick={() => toggleSkill(s.skill)}
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                          active
                            ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 scale-[1.02]"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        }`}
                      >
                        {active ? "✓ " : "+ "}
                        {s.skill}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-w-0 lg:col-span-6 rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs sm:text-sm font-bold text-white">
                    3. Live Fit Score &amp; Power-Ups
                  </h2>
                  {gapResult && gapResult.missing_skills.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCompleteQuest}
                      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-400/40 transition cursor-pointer"
                    >
                      ⚡ Auto-Complete Quest
                    </button>
                  )}
                  {analyzing && (
                    <span className="text-[11px] text-sky-400 animate-pulse">Simulating...</span>
                  )}
                </div>

                {!gapResult || !tier ? (
                  <div className="rounded-xl border border-dashed border-slate-800 p-5 text-center text-xs text-slate-400 my-auto">
                    Equip at least one skill or click <strong>🎲 Mystery Role</strong> to launch!
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-950 border border-slate-800 p-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-16 h-16 shrink-0">
                          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 76 76">
                            <circle
                              cx="38"
                              cy="38"
                              r={radius}
                              stroke="#1e293b"
                              strokeWidth="7"
                              fill="transparent"
                            />
                            <circle
                              cx="38"
                              cy="38"
                              r={radius}
                              stroke={tier.stroke}
                              strokeWidth="7"
                              strokeLinecap="round"
                              fill="transparent"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeOffset}
                              className="transition-all duration-500"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center font-extrabold text-sm text-white">
                            {Math.round(gapResult.match_score_pct)}%
                          </div>
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <span
                            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tier.bg} ${tier.color}`}
                          >
                            {tier.label}
                          </span>
                          <div className="text-xs text-slate-300 truncate">
                            Target: <strong className="text-white">{gapResult.target_label}</strong>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {gapResult.matched_skills.length}/{gapResult.target_skills.length} core
                            skills unlocked
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="rounded-lg bg-slate-950 border border-slate-800 p-2.5 min-w-0">
                        <div className="text-[10px] font-semibold text-emerald-400 mb-1">
                          ✅ Unlocked ({gapResult.matched_skills.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {gapResult.matched_skills.length > 0 ? (
                            gapResult.matched_skills.map((sk) => (
                              <span
                                key={sk}
                                className="px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-800/50 text-emerald-300 text-[10px]"
                              >
                                {sk}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 text-[10px]">None yet</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg bg-slate-950 border border-slate-800 p-2.5 min-w-0">
                        <div className="text-[10px] font-semibold text-amber-400 mb-1">
                          🎯 Missing (+{perSkillBoost}% fit each)
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {gapResult.missing_skills.length > 0 ? (
                            gapResult.missing_skills.map((sk) => (
                              <button
                                key={sk}
                                type="button"
                                onClick={() => addSkill(sk)}
                                className="px-1.5 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-200 text-[10px] transition cursor-pointer"
                              >
                                + {sk}
                              </button>
                            ))
                          ) : (
                            <span className="text-emerald-400 text-[10px]">100% Mastered!</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {gapResult.recommended_next_skills.map((rec) => {
                        const isTargetMissing = gapResult.missing_skills.includes(rec.skill);
                        return (
                          <div
                            key={rec.skill}
                            className="flex items-center justify-between gap-2 rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 min-w-0"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-[11px] text-white truncate">
                                {rec.skill}{" "}
                                <span className="font-mono text-[10px] text-sky-400">
                                  PMI {rec.pmi_score}
                                </span>
                                {isTargetMissing && (
                                  <span className="ml-1 text-[10px] text-emerald-400 font-bold">
                                    +{perSkillBoost}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => addSkill(rec.skill)}
                              className="shrink-0 px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500 hover:text-slate-950 text-sky-300 border border-sky-500/40 text-[10px] font-semibold transition cursor-pointer"
                            >
                              + Equip
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}