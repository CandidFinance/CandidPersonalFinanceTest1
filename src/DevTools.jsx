// ── Dev-only test profile loader ────────────────────────────────────────────
// This module is dynamically imported by main.jsx ONLY when
// import.meta.env.VITE_SHOW_DEV_TOOLS === "true" — set that in .env.local for
// local dev, and in Vercel's Development/Preview environment variables (never
// Production). See main.jsx for the gating; see README/DEV_TOOLS notes for how
// we confirmed this chunk is absent from a real production build.
import { useState } from "react";
import { Wrench } from "lucide-react";
import { calcMetrics, computeModuleStatuses, MODULE_META, sanitizeForMvp } from "./CandidApp.jsx";

const CUSTOM_PRESETS_KEY = "candid_dev_custom_presets";

// Shared realistic defaults — every BLANK_DATA field gets a concrete value here
// so each preset below is a genuinely complete input-state object, not a sparse
// override that happens to merge cleanly.
const baseProfile = {
  name: "", email: "", interests: [],
  selectedModules: [],
  age: "32", salary: "55000", otherIncome: "0", dividendIncome: "0", bonusAmount: "0", salaryTrajectory: "stable",
  monthlyExpenses: "1800", higherBuffer: "no",
  cashSavings: "10000", savingsRate: "2.5", premiumBonds: "0", cashAccessType: "yes",
  cashTiers: [{ amount: "10000", rate: "2.5" }],
  hasInvestments: "yes", isaUsedThisYear: "", isaPreviousBalance: "", isaType: "stocks", unwrappedValue: "0", unrealisedGains: "0",
  isaThisYearCash: "0", isaThisYearSS: "5000", isaThisYearLISA: "0", isaThisYearOther: "0",
  isaPrevCash: "0", isaPrevSS: "8000", isaPrevLISA: "0", isaPrevOther: "0",
  hasPension: "yes", myContribution: "5", employerMatch: "5", potValue: "30000", potValue2: "0", retirementAge: "65", pensionType: "sacrifice",
  pensionUnknown: false,
  niYears: "8",
  studentLoan: "none", loanBalance: "0", studentLoanRate: "",
  hasMortgage: "no", mortgageType: "fixed", mortgageBalance: "", mortgageRate: "", monthlyMortgage: "",
  fixExpiryMonth: "", fixExpiryYear: "", mortgageProvider: "", propertyEquity: "",
  ownsOutright: false, outrightPropertyValue: "",
  savingsGoal: "goals", investHorizon: "5to10",
  inheritDirection: "", estateValue: "", hasWill: "no",
  hasPersonalLoan: "no", personalLoanBalance: "", personalLoanRate: "", personalLoanMonthly: "", personalLoanTermRemaining: "", personalLoanAnnualExtra: "", personalLoanProvider: "",
  hasKids: "no", numKids: "", kidsAges: "", hasJISA: "no", juniorISAValue: "",
};

const BUILT_IN_PRESETS = [
  {
    id: "full",
    name: "Full user",
    description: "Realistic full financial picture — every active MVP module (cash, investments, pension, student loan) has a live recommendation. Mortgage/personal loan/kids left at defaults — those modules are hidden for MVP, see HIDE_MVP_MODULES in CandidApp.jsx.",
    data: {
      ...baseProfile,
      selectedModules: ["cash","investments","pension","studentLoan"],
      name: "Alex Full", email: "alex.full@example.com",
      age: "34", salary: "72000", otherIncome: "2000", dividendIncome: "500", bonusAmount: "5000", salaryTrajectory: "moderate",
      monthlyExpenses: "2200",
      cashSavings: "18000", savingsRate: "1.5", premiumBonds: "5000", cashAccessType: "yes",
      cashTiers: [{ amount: "18000", rate: "1.5" }],
      unwrappedValue: "6000", unrealisedGains: "3500",
      isaThisYearSS: "5000", isaPrevSS: "15000",
      myContribution: "3", employerMatch: "5", potValue: "55000", potValue2: "8000", niYears: "12",
      studentLoan: "plan2", loanBalance: "22000",
    },
  },
  {
    id: "maxedIsa",
    name: "Maxed ISA",
    description: "£0 ISA headroom remaining this tax year — tests the cash-vehicle substitution logic (surplus cash routes to non-ISA recommendations instead of ISA).",
    data: {
      ...baseProfile,
      selectedModules: ["cash","investments","pension"],
      name: "Jamie MaxedISA", email: "jamie.maxed@example.com",
      age: "29", salary: "48000",
      cashSavings: "12000", savingsRate: "2.8", cashTiers: [{ amount: "12000", rate: "2.8" }],
      unwrappedValue: "2000", unrealisedGains: "800",
      isaThisYearCash: "5000", isaThisYearSS: "15000", isaThisYearLISA: "0", isaThisYearOther: "0", // = £20,000, headroom = £0
      isaPrevSS: "10000",
      myContribution: "5", employerMatch: "5", potValue: "20000",
    },
  },
  {
    id: "largeSurplus",
    name: "Large surplus",
    description: "Cash balance well above ISA headroom — tests the blended ISA-eligible / non-ISA yield-gap calculation and the surplus-cash callout.",
    data: {
      ...baseProfile,
      selectedModules: ["cash","investments","pension"],
      name: "Sam LargeSurplus", email: "sam.surplus@example.com",
      age: "40", salary: "95000",
      monthlyExpenses: "1600",
      cashSavings: "45000", savingsRate: "2.0", cashTiers: [{ amount: "45000", rate: "2.0" }],
      premiumBonds: "8000",
      unwrappedValue: "10000", unrealisedGains: "4200",
      isaThisYearSS: "3000", isaPrevSS: "9000", // headroom = £17,000, cash = £45,000 >> headroom
      myContribution: "6", employerMatch: "6", potValue: "70000",
      niYears: "15",
    },
  },
  {
    id: "freshMinimal",
    name: "Fresh / minimal",
    description: "Mostly empty/zero state — only Savings selected, no investments, pension, mortgage, loan, or kids data. Tests zero-recommendation edge cases.",
    data: {
      ...baseProfile,
      selectedModules: ["cash"],
      name: "", email: "",
      age: "24", salary: "26000",
      monthlyExpenses: "1200",
      cashSavings: "500", savingsRate: "0", cashTiers: [{ amount: "500", rate: "0" }],
      hasInvestments: "no",
      isaThisYearSS: "0", isaPrevSS: "0",
      hasPension: "no", myContribution: "0", employerMatch: "0", potValue: "0", niYears: "2",
    },
  },
];

function loadCustomPresets() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || "[]"); }
  catch (e) { return []; }
}
function persistCustomPresets(list) {
  try { localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(list)); }
  catch (e) {}
}

// Builds a self-consistent insights object locally (no AI call) so the dashboard
// has something to render. Statuses/impacts come from the real computeModuleStatuses
// logic — only the prose summaries and score are placeholder/derived, clearly
// labelled as such via isDevPreset/the [DEV] prefix.
function buildSyntheticInsights(data) {
  // Sanitized the same way AppShell sanitizes real user data, so a preset's
  // synthetic score/statuses match what the actual app would show for the
  // same inputs (mortgage/personal loan/kids read as "na" while MVP-hidden).
  const dMvp = sanitizeForMvp(data);
  const m = calcMetrics(dMvp, {});
  const statuses = computeModuleStatuses(dMvp, m, {});
  const modules = {};
  let score = 100;
  MODULE_META.forEach(({ key, title }) => {
    const s = statuses[key] || { status: "na" };
    modules[key] = {
      status: s.status,
      summary: s.status === "na"
        ? "Not applicable based on your inputs."
        : s.impactLabel
          ? `[DEV] ${s.impactLabel}.`
          : `[DEV] Review your ${title.toLowerCase()}.`,
    };
    if (s.status === "critical") score -= 12;
    else if (s.status === "attention") score -= 5;
  });
  score = Math.max(10, Math.min(95, score));
  return {
    isDevPreset: true,
    score,
    headline: "[DEV PRESET] Synthetic report — not AI-generated.",
    narrative: "Loaded via the dev preset tool. Module statuses/£ impacts come from the real calcMetrics/computeModuleStatuses logic; summaries here are generic placeholders, not AI copy.",
    priorities: [],
    modules,
  };
}

export default function DevToolsPanel({ onPresetLoaded }) {
  const [open, setOpen] = useState(false);
  const [customPresets, setCustomPresets] = useState(loadCustomPresets);
  const [selected, setSelected] = useState(BUILT_IN_PRESETS[0].id);
  const [saveMode, setSaveMode] = useState(false);
  const [saveName, setSaveName] = useState("");

  const allPresets = [...BUILT_IN_PRESETS, ...customPresets];
  const activePreset = allPresets.find(p => p.id === selected) || BUILT_IN_PRESETS[0];
  const isCustomSelected = customPresets.some(p => p.id === selected);

  function handleLoad() {
    try {
      localStorage.setItem("candid_inputs", JSON.stringify(activePreset.data));
      localStorage.setItem("candid_insights", JSON.stringify(buildSyntheticInsights(activePreset.data)));
      localStorage.setItem("candid_insights_date", new Date().toISOString());
    } catch (e) {}
    onPresetLoaded();
  }

  function handleSaveCurrent() {
    const name = saveName.trim();
    if (!name) return;
    let data = null;
    try { data = JSON.parse(localStorage.getItem("candid_inputs") || "null"); } catch (e) {}
    if (!data) { window.alert("No current onboarding data found in this browser to save."); return; }
    const preset = { id: `custom-${Date.now()}`, name, description: "Saved from your current onboarding inputs.", data };
    const next = [...customPresets.filter(p => p.name !== name), preset];
    setCustomPresets(next);
    persistCustomPresets(next);
    setSaveName("");
    setSaveMode(false);
    setSelected(preset.id);
  }

  function handleDelete(id) {
    const next = customPresets.filter(p => p.id !== id);
    setCustomPresets(next);
    persistCustomPresets(next);
    if (selected === id) setSelected(BUILT_IN_PRESETS[0].id);
  }

  const G = "#162f24", GOLD = "#c4963a", CREAM = "#f6f0e6";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{
        position: "fixed", top: "16px", right: "16px", zIndex: 999999,
        background: GOLD, color: G, border: "none", borderRadius: "8px",
        padding: "8px 14px", fontWeight: 700, fontSize: "12px", cursor: "pointer",
        fontFamily: "'DM Sans',sans-serif", boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        display: "flex", alignItems: "center", gap: "6px",
      }}>
        <Wrench size={13}/> DEV TOOLS
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", top: "16px", right: "16px", zIndex: 999999, width: "300px",
      background: G, color: CREAM, borderRadius: "10px", padding: "14px",
      fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.4)", border: "1px solid rgba(196,150,58,0.5)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <span style={{ fontWeight: 700, color: GOLD, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "5px" }}>
          <Wrench size={12}/> Dev tools — test profiles
        </span>
        <button type="button" onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: "rgba(246,240,230,0.6)", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>×</button>
      </div>

      <select value={selected} onChange={e => setSelected(e.target.value)} style={{
        width: "100%", padding: "6px 8px", borderRadius: "6px", marginBottom: "6px",
        border: "1px solid rgba(255,255,255,0.2)", background: "#0f2018", color: CREAM, fontSize: "12px",
      }}>
        <optgroup label="Built-in presets">
          {BUILT_IN_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </optgroup>
        {customPresets.length > 0 && (
          <optgroup label="Your saved presets">
            {customPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
        )}
      </select>

      {activePreset?.description && (
        <p style={{ fontSize: "11px", color: "rgba(246,240,230,0.6)", lineHeight: 1.5, margin: "0 0 10px" }}>{activePreset.description}</p>
      )}

      <button type="button" onClick={handleLoad} style={{
        width: "100%", padding: "8px", background: GOLD, color: G, border: "none",
        borderRadius: "6px", fontWeight: 700, fontSize: "12px", cursor: "pointer", marginBottom: "8px",
      }}>
        Load → Dashboard
      </button>

      {isCustomSelected && (
        <button type="button" onClick={() => handleDelete(activePreset.id)} style={{
          width: "100%", padding: "6px", background: "transparent", color: "#e08b7d",
          border: "1px solid rgba(192,57,43,0.4)", borderRadius: "6px", fontSize: "11px",
          cursor: "pointer", marginBottom: "8px",
        }}>
          Delete this saved preset
        </button>
      )}

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: "8px", marginTop: "4px" }}>
        {!saveMode ? (
          <button type="button" onClick={() => setSaveMode(true)} style={{
            width: "100%", padding: "7px", background: "transparent", border: "1px solid rgba(196,150,58,0.5)",
            borderRadius: "6px", color: GOLD, fontSize: "11px", cursor: "pointer",
          }}>
            + Save current onboarding data as preset
          </button>
        ) : (
          <div>
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Preset name"
              style={{
                width: "100%", padding: "6px 8px", borderRadius: "6px", marginBottom: "6px",
                border: "1px solid rgba(255,255,255,0.2)", background: "#0f2018", color: CREAM, fontSize: "12px",
              }}
            />
            <div style={{ display: "flex", gap: "6px" }}>
              <button type="button" onClick={handleSaveCurrent} style={{
                flex: 1, padding: "6px", background: GOLD, color: G, border: "none",
                borderRadius: "6px", fontWeight: 700, fontSize: "11px", cursor: "pointer",
              }}>Save</button>
              <button type="button" onClick={() => { setSaveMode(false); setSaveName(""); }} style={{
                flex: 1, padding: "6px", background: "transparent", color: "rgba(246,240,230,0.7)",
                border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", fontSize: "11px", cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
