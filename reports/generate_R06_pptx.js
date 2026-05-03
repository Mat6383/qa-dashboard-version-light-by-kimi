const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "QA Dashboard — Neo-Logix";
pres.title = "Clôture de Tests R06";

// === PALETTE (Ocean/Navy executive) ===
const C = {
  navy:     "0F172A",
  blue:     "1E3A5F",
  accent:   "3B82F6",
  sky:      "38BDF8",
  green:    "10B981",
  red:      "EF4444",
  orange:   "F59E0B",
  white:    "FFFFFF",
  light:    "F8FAFC",
  gray:     "64748B",
  darkGray: "334155",
  text:     "1E293B",
  ice:      "CADCFC",
};

const mkShadow = () => ({ type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.12 });

// ================================================================
// SLIDE 1: COVER
// ================================================================
let s1 = pres.addSlide();
s1.background = { color: C.navy };

// Top badge
s1.addShape(pres.shapes.RECTANGLE, { x: 3.0, y: 0.6, w: 4.0, h: 0.4, fill: { color: C.blue } });
s1.addText("ISTQB  •  LEAN  •  ITIL", { x: 3.0, y: 0.6, w: 4.0, h: 0.4, fontSize: 9, color: C.sky, align: "center", valign: "middle", fontFace: "Calibri", charSpacing: 3 });

// Title
s1.addText("Rapport de Clôture de Tests", { x: 0.5, y: 1.4, w: 9, h: 0.9, fontSize: 36, fontFace: "Calibri", bold: true, color: C.white, align: "center", margin: 0 });
s1.addText("Release R06 — Test Closure Report", { x: 0.5, y: 2.2, w: 9, h: 0.5, fontSize: 16, fontFace: "Calibri", color: C.gray, align: "center", margin: 0 });

// Decision
s1.addText("GO SOUS RÉSERVE", { x: 1.0, y: 3.1, w: 8, h: 0.8, fontSize: 40, fontFace: "Calibri", bold: true, color: C.orange, align: "center", margin: 0 });
s1.addText("Décision conditionnelle — Critères partiellement atteints", { x: 1.0, y: 3.9, w: 8, h: 0.35, fontSize: 11, fontFace: "Calibri", color: C.gray, align: "center", margin: 0 });

// Bottom info bar
s1.addShape(pres.shapes.RECTANGLE, { x: 0, y: 4.6, w: 10, h: 1.025, fill: { color: C.blue } });

const infoRows = [
  [
    { text: "Projet: ", options: { color: C.gray, fontSize: 9, fontFace: "Calibri" } },
    { text: "Neo-Logix — QA Préprod    ", options: { color: C.ice, fontSize: 9, fontFace: "Calibri", bold: true } },
    { text: "Période: ", options: { color: C.gray, fontSize: 9, fontFace: "Calibri" } },
    { text: "09 fév. → 27 mars 2026 (46j)    ", options: { color: C.ice, fontSize: 9, fontFace: "Calibri", bold: true } },
    { text: "Périmètre: ", options: { color: C.gray, fontSize: 9, fontFace: "Calibri" } },
    { text: "12 runs + 3 sessions exploratoires", options: { color: C.ice, fontSize: 9, fontFace: "Calibri", bold: true } },
  ]
];
s1.addText(infoRows, { x: 0.5, y: 4.75, w: 9, h: 0.6, valign: "middle", align: "center" });

// ================================================================
// SLIDE 2: RÉSUMÉ EXÉCUTIF — KPI
// ================================================================
let s2 = pres.addSlide();
s2.background = { color: C.light };

s2.addText("Résumé exécutif", { x: 0.5, y: 0.3, w: 6, h: 0.5, fontSize: 28, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });
s2.addText("Executive Summary — ISTQB §5.4.2", { x: 0.5, y: 0.75, w: 6, h: 0.3, fontSize: 10, fontFace: "Calibri", color: C.gray, margin: 0 });

// KPI Cards (4 across)
const kpis = [
  { label: "Taux d'exécution\n(Completion Rate)", value: "98,8%", target: "Cible ≥ 90% ✓", color: C.green, ok: true },
  { label: "Taux de succès\n(Pass Rate)", value: "83,3%", target: "Cible ≥ 95% ✗", color: C.red, ok: false },
  { label: "Taux d'échec\n(Failure Rate)", value: "15,4%", target: "Cible ≤ 5% ✗", color: C.red, ok: false },
  { label: "Efficacité\n(Test Efficiency)", value: "84,4%", target: "Cible ≥ 95% ✗", color: C.orange, ok: false },
];

kpis.forEach((k, i) => {
  const x = 0.4 + i * 2.35;
  s2.addShape(pres.shapes.RECTANGLE, { x, y: 1.3, w: 2.15, h: 1.7, fill: { color: C.white }, shadow: mkShadow() });
  s2.addShape(pres.shapes.RECTANGLE, { x, y: 1.3, w: 2.15, h: 0.06, fill: { color: k.color } });
  s2.addText(k.value, { x, y: 1.5, w: 2.15, h: 0.7, fontSize: 32, fontFace: "Calibri", bold: true, color: k.color, align: "center", valign: "middle", margin: 0 });
  s2.addText(k.label, { x, y: 2.15, w: 2.15, h: 0.45, fontSize: 8.5, fontFace: "Calibri", color: C.gray, align: "center", valign: "top", margin: 0 });
  s2.addText(k.target, { x: x + 0.2, y: 2.65, w: 1.75, h: 0.25, fontSize: 7.5, fontFace: "Calibri", color: k.ok ? C.green : C.red, align: "center", valign: "middle", fill: { color: k.ok ? "DCFCE7" : "FEE2E2" } });
});

// Volumes
s2.addText("Volumes de la campagne", { x: 0.5, y: 3.3, w: 4, h: 0.35, fontSize: 14, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });

const volData = [
  [
    { text: "Indicateur", options: { bold: true, color: C.white, fontSize: 9, fill: { color: C.blue } } },
    { text: "Valeur", options: { bold: true, color: C.white, fontSize: 9, fill: { color: C.blue } } },
  ],
  ["Total cas de test (Test Cases)", "164"],
  ["Tests exécutés (Executed)", "162"],
  ["Tests réussis (Passed)", "135"],
  ["Tests échoués (Failed)", "25"],
  ["Ignorés / WIP (Skipped / WIP)", "2 / 2"],
  ["Sessions exploratoires", "3"],
  ["Nombre de runs", "12"],
];
s2.addTable(volData, { x: 0.5, y: 3.7, w: 4.2, h: 1.6, fontSize: 9, fontFace: "Calibri", color: C.text, border: { pt: 0.5, color: "E2E8F0" }, colW: [2.8, 1.4], autoPage: false });

// Stacked bar representation
s2.addText("Répartition des statuts", { x: 5.3, y: 3.3, w: 4.2, h: 0.35, fontSize: 14, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });
// Passed
s2.addShape(pres.shapes.RECTANGLE, { x: 5.3, y: 3.85, w: 3.45, h: 0.35, fill: { color: C.green } });
s2.addText("Réussis: 135 (82%)", { x: 5.3, y: 3.85, w: 3.45, h: 0.35, fontSize: 9, fontFace: "Calibri", bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
// Failed
s2.addShape(pres.shapes.RECTANGLE, { x: 8.75, y: 3.85, w: 0.65, h: 0.35, fill: { color: C.red } });
s2.addText("25", { x: 8.75, y: 3.85, w: 0.65, h: 0.35, fontSize: 9, fontFace: "Calibri", bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });

// Legend
s2.addShape(pres.shapes.RECTANGLE, { x: 5.3, y: 4.4, w: 0.2, h: 0.15, fill: { color: C.green } });
s2.addText("Réussis (Passed)", { x: 5.55, y: 4.38, w: 1.5, h: 0.2, fontSize: 8, fontFace: "Calibri", color: C.gray, margin: 0 });
s2.addShape(pres.shapes.RECTANGLE, { x: 7.1, y: 4.4, w: 0.2, h: 0.15, fill: { color: C.red } });
s2.addText("Échoués (Failed)", { x: 7.35, y: 4.38, w: 1.5, h: 0.2, fontSize: 8, fontFace: "Calibri", color: C.gray, margin: 0 });
s2.addShape(pres.shapes.RECTANGLE, { x: 8.9, y: 4.4, w: 0.2, h: 0.15, fill: { color: C.orange } });
s2.addText("WIP/Skip", { x: 9.15, y: 4.38, w: 0.7, h: 0.2, fontSize: 8, fontFace: "Calibri", color: C.gray, margin: 0 });

// ================================================================
// SLIDE 3: RÉSULTATS PAR RUN (TABLEAU)
// ================================================================
let s3 = pres.addSlide();
s3.background = { color: C.light };

s3.addText("Résultats par run", { x: 0.5, y: 0.3, w: 6, h: 0.5, fontSize: 28, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });
s3.addText("Detailed Test Results — ISTQB §5.4", { x: 0.5, y: 0.75, w: 6, h: 0.3, fontSize: 10, fontFace: "Calibri", color: C.gray, margin: 0 });

const headerOpts = { bold: true, color: C.white, fontSize: 8, fill: { color: C.blue }, align: "center", valign: "middle" };

const runRows = [
  [
    { text: "Run", options: headerOpts },
    { text: "Total", options: headerOpts },
    { text: "Réussis", options: headerOpts },
    { text: "Échoués", options: headerOpts },
    { text: "Skip", options: headerOpts },
    { text: "WIP", options: headerOpts },
    { text: "Exéc. %", options: headerOpts },
    { text: "Succès %", options: headerOpts },
  ],
  [{ text: "Run 1", options: { fontSize: 8, bold: true } }, "92", { text: "77", options: { color: C.green, fontSize: 8 } }, { text: "14", options: { color: C.red, fontSize: 8 } }, "1", "0", "100%", { text: "83,7%", options: { color: C.red, fontSize: 8, bold: true } }],
  [{ text: "Run 2", options: { fontSize: 8, bold: true } }, "8", { text: "7", options: { color: C.green, fontSize: 8 } }, "0", "1", "0", "100%", { text: "87,5%", options: { color: C.orange, fontSize: 8 } }],
  [{ text: "Run 3", options: { fontSize: 8, bold: true } }, "14", { text: "11", options: { color: C.green, fontSize: 8 } }, { text: "3", options: { color: C.red, fontSize: 8 } }, "0", "0", "100%", { text: "78,6%", options: { color: C.red, fontSize: 8 } }],
  [{ text: "Run 4", options: { fontSize: 8, bold: true } }, "11", { text: "8", options: { color: C.green, fontSize: 8 } }, { text: "3", options: { color: C.red, fontSize: 8 } }, "0", "0", "100%", { text: "72,7%", options: { color: C.red, fontSize: 8 } }],
  [{ text: "Run 5", options: { fontSize: 8, bold: true } }, "5", { text: "3", options: { color: C.green, fontSize: 8 } }, "0", "0", { text: "2", options: { color: C.orange, fontSize: 8 } }, { text: "60%", options: { color: C.red, fontSize: 8 } }, { text: "100%", options: { color: C.green, fontSize: 8 } }],
  [{ text: "Run 6", options: { fontSize: 8, bold: true } }, "2", { text: "2", options: { color: C.green, fontSize: 8 } }, "0", "0", "0", "100%", { text: "100%", options: { color: C.green, fontSize: 8 } }],
  [{ text: "Run 7", options: { fontSize: 8, bold: true } }, "2", { text: "2", options: { color: C.green, fontSize: 8 } }, "0", "0", "0", "100%", { text: "100%", options: { color: C.green, fontSize: 8 } }],
  [{ text: "Run 8", options: { fontSize: 8, bold: true } }, "6", { text: "5", options: { color: C.green, fontSize: 8 } }, { text: "1", options: { color: C.red, fontSize: 8 } }, "0", "0", "100%", { text: "83,3%", options: { color: C.red, fontSize: 8 } }],
  [{ text: "Run 9", options: { fontSize: 8, bold: true } }, "4", { text: "4", options: { color: C.green, fontSize: 8 } }, "0", "0", "0", "100%", { text: "100%", options: { color: C.green, fontSize: 8 } }],
  [
    { text: "TOTAL", options: { fontSize: 8, bold: true, fill: { color: "E2E8F0" } } },
    { text: "144", options: { fontSize: 8, bold: true, fill: { color: "E2E8F0" } } },
    { text: "119", options: { fontSize: 8, bold: true, color: C.green, fill: { color: "E2E8F0" } } },
    { text: "21", options: { fontSize: 8, bold: true, color: C.red, fill: { color: "E2E8F0" } } },
    { text: "2", options: { fontSize: 8, bold: true, fill: { color: "E2E8F0" } } },
    { text: "2", options: { fontSize: 8, bold: true, fill: { color: "E2E8F0" } } },
    { text: "98,6%", options: { fontSize: 8, bold: true, fill: { color: "E2E8F0" } } },
    { text: "83,8%", options: { fontSize: 8, bold: true, color: C.red, fill: { color: "E2E8F0" } } },
  ],
];
s3.addTable(runRows, { x: 0.3, y: 1.2, w: 9.4, fontSize: 8, fontFace: "Calibri", color: C.text, border: { pt: 0.5, color: "E2E8F0" }, colW: [1.3, 0.8, 0.9, 0.9, 0.7, 0.7, 1.0, 1.0], autoPage: false, align: "center", valign: "middle" });

// TNR section
s3.addText("Tests de non-régression (TNR — Regression Testing)", { x: 0.5, y: 3.95, w: 6, h: 0.35, fontSize: 14, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });

const tnrRows = [
  [
    { text: "Run TNR", options: headerOpts },
    { text: "Total", options: headerOpts },
    { text: "Réussis", options: headerOpts },
    { text: "Échoués", options: headerOpts },
    { text: "Taux succès", options: headerOpts },
    { text: "Statut", options: headerOpts },
  ],
  ["TNR — Flux de production", "18", { text: "15", options: { color: C.green, fontSize: 8 } }, { text: "3", options: { color: C.red, fontSize: 8 } }, { text: "83,3%", options: { color: C.red, fontSize: 8, bold: true } }, { text: "ATTENTION", options: { color: C.orange, fontSize: 8, bold: true } }],
  ["TNR — Tableaux de bord", "1", "0", { text: "1", options: { color: C.red, fontSize: 8 } }, { text: "0%", options: { color: C.red, fontSize: 8, bold: true } }, { text: "CRITIQUE", options: { color: C.red, fontSize: 8, bold: true } }],
  ["TNR — Analyseur", "1", { text: "1", options: { color: C.green, fontSize: 8 } }, "0", { text: "100%", options: { color: C.green, fontSize: 8, bold: true } }, { text: "OK", options: { color: C.green, fontSize: 8, bold: true } }],
];
s3.addTable(tnrRows, { x: 0.5, y: 4.35, w: 9, fontSize: 8, fontFace: "Calibri", color: C.text, border: { pt: 0.5, color: "E2E8F0" }, colW: [2.8, 0.8, 0.9, 0.9, 1.3, 1.2], autoPage: false, align: "center", valign: "middle" });

// ================================================================
// SLIDE 4: SESSIONS EXPLORATOIRES + CHART
// ================================================================
let s4 = pres.addSlide();
s4.background = { color: C.light };

s4.addText("Sessions exploratoires & Analyse", { x: 0.5, y: 0.3, w: 7, h: 0.5, fontSize: 28, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });
s4.addText("Exploratory Testing (ISTQB §4.4.2) & Defect Analysis", { x: 0.5, y: 0.75, w: 7, h: 0.3, fontSize: 10, fontFace: "Calibri", color: C.gray, margin: 0 });

// Sessions table
const sessRows = [
  [
    { text: "Session exploratoire", options: headerOpts },
    { text: "Résultats", options: headerOpts },
    { text: "Statut", options: headerOpts },
    { text: "Date", options: headerOpts },
  ],
  ["TEST Exploratoire Sophie", { text: "4 anomalies", options: { color: C.red, fontSize: 9 } }, { text: "ÉCHEC", options: { color: C.red, fontSize: 9, bold: true } }, "13/03/2026"],
  ["TEST Exploratoire GWELL GAB", { text: "1 réussi / 1 échoué", options: { color: C.orange, fontSize: 9 } }, { text: "MIXTE", options: { color: C.orange, fontSize: 9, bold: true } }, "17/03/2026"],
  ["TEST Exploratoire Pauline", { text: "En cours", options: { color: C.gray, fontSize: 9 } }, { text: "EN COURS", options: { color: C.gray, fontSize: 9, bold: true } }, "27/03/2026"],
];
s4.addTable(sessRows, { x: 0.5, y: 1.2, w: 9, fontSize: 9, fontFace: "Calibri", color: C.text, border: { pt: 0.5, color: "E2E8F0" }, colW: [3.2, 2.0, 1.5, 1.3], autoPage: false, align: "center", valign: "middle" });

// Defect distribution chart
s4.addText("Distribution des anomalies par source", { x: 0.5, y: 2.7, w: 5, h: 0.35, fontSize: 14, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });

s4.addChart(pres.charts.BAR, [{
  name: "Anomalies",
  labels: ["Run 1", "Run 3", "Run 4", "Run 8", "TNR Flux", "TNR TdB", "Explo."],
  values: [14, 3, 3, 1, 3, 1, 5],
}], {
  x: 0.3, y: 3.05, w: 5.5, h: 2.3, barDir: "col",
  chartColors: [C.red],
  chartArea: { fill: { color: C.white }, roundedCorners: true },
  catAxisLabelColor: C.gray,
  valAxisLabelColor: C.gray,
  catAxisLabelFontSize: 8,
  valAxisLabelFontSize: 8,
  valGridLine: { color: "E2E8F0", size: 0.5 },
  catGridLine: { style: "none" },
  showValue: true,
  dataLabelPosition: "outEnd",
  dataLabelColor: C.text,
  dataLabelFontSize: 9,
  showLegend: false,
});

// Right side: key insight
s4.addShape(pres.shapes.RECTANGLE, { x: 6.2, y: 3.05, w: 3.5, h: 2.3, fill: { color: C.white }, shadow: mkShadow() });
s4.addShape(pres.shapes.RECTANGLE, { x: 6.2, y: 3.05, w: 0.07, h: 2.3, fill: { color: C.accent } });

s4.addText("Analyse clé", { x: 6.5, y: 3.15, w: 3.0, h: 0.3, fontSize: 13, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });
s4.addText([
  { text: "Le Run 1 concentre 56% des échecs", options: { bold: true, fontSize: 9, breakLine: true } },
  { text: "(14/25), confirmant le principe ISTQB de regroupement des défauts (Defect Clustering §1.3).", options: { fontSize: 9, breakLine: true } },
  { text: "", options: { fontSize: 6, breakLine: true } },
  { text: "Tendance positive :", options: { bold: true, fontSize: 9, breakLine: true } },
  { text: "Les runs tardifs (6, 7, 10) affichent 100% de succès. Le produit se stabilise.", options: { fontSize: 9, breakLine: true } },
  { text: "", options: { fontSize: 6, breakLine: true } },
  { text: "Session Sophie :", options: { bold: true, fontSize: 9, color: C.red, breakLine: true } },
  { text: "4 anomalies en 1 session = cluster significatif nécessitant investigation.", options: { fontSize: 9 } },
], { x: 6.5, y: 3.5, w: 3.0, h: 1.7, fontFace: "Calibri", color: C.text, valign: "top", margin: 0 });

// ================================================================
// SLIDE 5: CRITÈRES DE SORTIE
// ================================================================
let s5 = pres.addSlide();
s5.background = { color: C.light };

s5.addText("Critères de sortie", { x: 0.5, y: 0.3, w: 6, h: 0.5, fontSize: 28, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });
s5.addText("Exit Criteria Assessment — ISTQB §5.2.3", { x: 0.5, y: 0.75, w: 6, h: 0.3, fontSize: 10, fontFace: "Calibri", color: C.gray, margin: 0 });

const criteria = [
  { label: "Taux d'exécution ≥ 90%", value: "98,8%", ok: true, detail: "Quasi-totalité des cas exécutés" },
  { label: "Taux de succès ≥ 95%", value: "83,3%", ok: false, detail: "Écart de 11,7 pts — Run 1 et TNR Flux pèsent" },
  { label: "Taux d'échec ≤ 5%", value: "15,4%", ok: false, detail: "25 échecs sur 162 exécutés — RCA nécessaire" },
  { label: "Efficacité ≥ 95%", value: "84,4%", ok: false, detail: "Ratio first-pass insuffisant" },
  { label: "Taux de blocage ≤ 5%", value: "0%", ok: true, detail: "Aucun test bloqué — environnement stable" },
];

criteria.forEach((c, i) => {
  const y = 1.3 + i * 0.75;
  s5.addShape(pres.shapes.RECTANGLE, { x: 0.5, y, w: 9, h: 0.6, fill: { color: C.white }, shadow: mkShadow() });
  s5.addShape(pres.shapes.RECTANGLE, { x: 0.5, y, w: 0.07, h: 0.6, fill: { color: c.ok ? C.green : C.red } });

  // Icon
  s5.addShape(pres.shapes.OVAL, { x: 0.75, y: y + 0.12, w: 0.36, h: 0.36, fill: { color: c.ok ? "DCFCE7" : "FEE2E2" } });
  s5.addText(c.ok ? "✓" : "✗", { x: 0.75, y: y + 0.12, w: 0.36, h: 0.36, fontSize: 14, fontFace: "Calibri", bold: true, color: c.ok ? "166534" : "991B1B", align: "center", valign: "middle", margin: 0 });

  // Label + value
  s5.addText(c.label, { x: 1.3, y, w: 4.5, h: 0.6, fontSize: 12, fontFace: "Calibri", bold: true, color: C.text, valign: "middle", margin: 0 });
  s5.addText(c.value, { x: 5.8, y, w: 1.2, h: 0.6, fontSize: 18, fontFace: "Calibri", bold: true, color: c.ok ? C.green : C.red, align: "center", valign: "middle", margin: 0 });
  s5.addText(c.detail, { x: 7.1, y, w: 2.3, h: 0.6, fontSize: 8.5, fontFace: "Calibri", color: C.gray, valign: "middle", margin: 0 });
});

// Summary box
s5.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 5.0, w: 9, h: 0.45, fill: { color: "FFFBEB" } });
s5.addText("Bilan ISTQB : 2 critères sur 5 atteints. Les critères non satisfaits doivent être acceptés formellement (§5.2.3).", { x: 0.7, y: 5.0, w: 8.6, h: 0.45, fontSize: 9, fontFace: "Calibri", color: "92400E", valign: "middle", margin: 0, bold: true });

// ================================================================
// SLIDE 6: INCIDENTS
// ================================================================
let s6 = pres.addSlide();
s6.background = { color: C.light };

s6.addText("Incidents notables", { x: 0.5, y: 0.3, w: 7, h: 0.5, fontSize: 28, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });
s6.addText("ISTQB §5.3 Defect Report / ITIL Incident Management", { x: 0.5, y: 0.75, w: 7, h: 0.3, fontSize: 10, fontFace: "Calibri", color: C.gray, margin: 0 });

const incidents = [
  {
    title: "INC-01 : Cas de test incomplets",
    severity: "Impact élevé",
    sevColor: C.red,
    desc: "Étapes d'exécution insuffisamment détaillées → perte de temps pour les testeurs.",
    lean: "LEAN Muda (gaspillage) : temps perdu à clarifier les cas de test.",
    action: "Instaurer une revue de testabilité (Testability Review) avant chaque campagne.",
  },
  {
    title: "INC-02 : Cron Boucheron — Instabilité processus",
    severity: "Impact élevé",
    sevColor: C.red,
    desc: "Tickets successifs avec changements de processus causés par différentes sources → anomalies en cascade.",
    lean: "LEAN Mura (irrégularité) : changements non coordonnés.",
    action: "Processus Change Management ITIL (CAB) pour les modifications de processus automatisés.",
  },
  {
    title: "INC-03 : Cluster d'anomalies — Session Sophie",
    severity: "Impact moyen",
    sevColor: C.orange,
    desc: "4 anomalies en 1 session exploratoire → zone fonctionnelle fragile identifiée.",
    lean: "ISTQB §1.3 Defect Clustering : concentration des défauts dans un module.",
    action: "Analyse de cause racine (RCA) sur la zone impactée.",
  },
];

incidents.forEach((inc, i) => {
  const y = 1.2 + i * 1.4;
  s6.addShape(pres.shapes.RECTANGLE, { x: 0.5, y, w: 9, h: 1.2, fill: { color: C.white }, shadow: mkShadow() });
  s6.addShape(pres.shapes.RECTANGLE, { x: 0.5, y, w: 0.07, h: 1.2, fill: { color: inc.sevColor } });

  s6.addText(inc.title, { x: 0.8, y, w: 5.5, h: 0.3, fontSize: 12, fontFace: "Calibri", bold: true, color: C.text, valign: "middle", margin: 0 });
  s6.addText(inc.severity, { x: 7.8, y: y + 0.02, w: 1.5, h: 0.25, fontSize: 8, fontFace: "Calibri", bold: true, color: inc.sevColor, align: "center", valign: "middle", fill: { color: inc.sevColor === C.red ? "FEE2E2" : "FEF3C7" } });

  s6.addText(inc.desc, { x: 0.8, y: y + 0.32, w: 8.5, h: 0.25, fontSize: 9, fontFace: "Calibri", color: C.darkGray, margin: 0 });
  s6.addText(inc.lean, { x: 0.8, y: y + 0.58, w: 8.5, h: 0.25, fontSize: 9, fontFace: "Calibri", color: C.gray, italic: true, margin: 0 });
  s6.addText("Action : " + inc.action, { x: 0.8, y: y + 0.84, w: 8.5, h: 0.25, fontSize: 9, fontFace: "Calibri", color: C.accent, bold: true, margin: 0 });
});

// ================================================================
// SLIDE 7: TRAÇABILITÉ TICKETS GITLAB
// ================================================================
let s7t = pres.addSlide();
s7t.background = { color: C.light };

s7t.addText("Traçabilité des tickets GitLab", { x: 0.5, y: 0.3, w: 7, h: 0.5, fontSize: 24, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });
s7t.addText("Defect Traceability — ISTQB §5.3", { x: 0.5, y: 0.75, w: 6, h: 0.3, fontSize: 10, fontFace: "Calibri", color: C.gray, margin: 0 });

const ticketHeaderOpts = { bold: true, color: C.white, fontSize: 7, fill: { color: C.blue }, align: "center", valign: "middle" };
const ticketFail = { color: C.red, bold: true, fontSize: 7 };
const ticketPass = { color: C.green, bold: true, fontSize: 7 };
const ticketRows = [
  [
    { text: "Run", options: ticketHeaderOpts },
    { text: "Cas de test (Test Case)", options: { ...ticketHeaderOpts, align: "left" } },
    { text: "Statut", options: ticketHeaderOpts },
    { text: "Ticket correction", options: ticketHeaderOpts },
  ],
  ["run 1", "[STOCK] Modifier la série après entrée interne", { text: "FAILED", options: ticketFail }, { text: "#7802", options: { bold: true, fontSize: 7 } }],
  ["run 1", "[ODF] Faire redescendre la date de livraison", { text: "FAILED", options: ticketFail }, { text: "#7792", options: { bold: true, fontSize: 7 } }],
  ["run 1", "[EDI] Import stock : optimisation des traitements", { text: "FAILED", options: ticketFail }, { text: "#7787", options: { bold: true, fontSize: 7 } }],
  ["run 1", "[FACTURE][CONFIE] Ajout des frais de port", { text: "FAILED", options: ticketFail }, { text: "#7786", options: { bold: true, fontSize: 7 } }],
  ["run 1", "[GENERAL] Numérique au format US 1,000.00", { text: "FAILED", options: ticketFail }, { text: "#7781", options: { bold: true, fontSize: 7 } }],
  ["run 1", "[ARTICLE] Le filtre: Article créé depuis le…", { text: "FAILED", options: ticketFail }, { text: "#7784", options: { bold: true, fontSize: 7 } }],
  ["run 3", "[ERC] Nouveau document CJI", { text: "FAILED", options: ticketFail }, { text: "#7806", options: { bold: true, fontSize: 7 } }],
  ["run 3", "[CRON] Deport cron Boucheron vers Pilote", { text: "FAILED", options: ticketFail }, { text: "#7794", options: { bold: true, fontSize: 7 } }],
  ["run 4", "[EDI][STOCK] Ajout valeurs douanières import appro", { text: "FAILED", options: ticketFail }, { text: "#7831", options: { bold: true, fontSize: 7 } }],
  ["run 4", "[GENERAL] Numérique format US — Retours 2", { text: "FAILED", options: ticketFail }, { text: "#7807", options: { bold: true, fontSize: 7 } }],
  ["TNR", "09 — Avoir / Livre de police", { text: "FAILED", options: ticketFail }, { text: "#7821", options: { bold: true, fontSize: 7 } }],
  ["TNR", "07 — Transformations", { text: "FAILED", options: ticketFail }, { text: "#7811", options: { bold: true, fontSize: 7 } }],
  ["run 8", "[VALORISATION METAL] COFITER / COFIPAC KO", { text: "FAILED", options: ticketFail }, { text: "#7834", options: { bold: true, fontSize: 7 } }],
  ["run 1", "[CONFIE] Ajout frais de port état standard", { text: "PASSED", options: ticketPass }, { text: "#7774", options: { bold: true, fontSize: 7, color: C.green } }],
  ["run 2", "[ARIBA] Articles avec prix à 0", { text: "PASSED", options: ticketPass }, { text: "#7796", options: { bold: true, fontSize: 7, color: C.green } }],
  ["run 5", "[CDE ACHAT][CP] Solde ligne — mvt prévi.", { text: "PASSED", options: ticketPass }, { text: "#7824", options: { bold: true, fontSize: 7, color: C.green } }],
];
s7t.addTable(ticketRows, { x: 0.2, y: 1.1, w: 9.6, fontSize: 7, fontFace: "Calibri", color: C.text, border: { pt: 0.4, color: "E2E8F0" }, colW: [0.7, 4.2, 0.8, 1.5], autoPage: false, align: "center", valign: "middle" });

s7t.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.65, w: 9, h: 0.45, fill: { color: "EFF6FF" } });
s7t.addText("13 tickets de correction créés pour les tests FAILED — 3 tickets de suivi pour les tests PASSED", { x: 0.7, y: 4.65, w: 8.6, h: 0.45, fontSize: 9, fontFace: "Calibri", color: C.accent, valign: "middle", margin: 0, bold: true });

// ================================================================
// SLIDE 8: RISQUES RÉSIDUELS
// ================================================================
let s8r = pres.addSlide();
s8r.background = { color: C.light };

s8r.addText("Risques résiduels", { x: 0.5, y: 0.3, w: 6, h: 0.5, fontSize: 28, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });
s8r.addText("Residual Risks — ISTQB §5.4.2", { x: 0.5, y: 0.75, w: 6, h: 0.3, fontSize: 10, fontFace: "Calibri", color: C.gray, margin: 0 });

const riskHeaderOpts = { bold: true, color: C.white, fontSize: 8, fill: { color: C.blue }, align: "center", valign: "middle" };
const riskRows = [
  [
    { text: "#", options: riskHeaderOpts },
    { text: "Risque", options: riskHeaderOpts },
    { text: "Prob.", options: riskHeaderOpts },
    { text: "Impact", options: riskHeaderOpts },
    { text: "Niveau", options: riskHeaderOpts },
    { text: "Mitigation", options: riskHeaderOpts },
  ],
  ["R1", "14 échecs non résolus (Run 1)", { text: "Moy.", options: { color: C.orange, bold: true, fontSize: 8 } }, { text: "Élevé", options: { color: C.red, bold: true, fontSize: 8 } }, { text: "CRITIQUE", options: { color: C.red, bold: true, fontSize: 8 } }, "Re-test ciblé avant MEP"],
  ["R2", "TNR Tableaux de bord en échec total", { text: "Élevée", options: { color: C.red, bold: true, fontSize: 8 } }, { text: "Moyen", options: { color: C.orange, bold: true, fontSize: 8 } }, { text: "CRITIQUE", options: { color: C.red, bold: true, fontSize: 8 } }, "Investigation & correction"],
  ["R3", "2 tests WIP dans le Run 5", { text: "Moy.", options: { color: C.orange, bold: true, fontSize: 8 } }, { text: "Moyen", options: { color: C.orange, bold: true, fontSize: 8 } }, { text: "MODÉRÉ", options: { color: C.orange, bold: true, fontSize: 8 } }, "Finaliser avant MEP"],
  ["R4", "Session exploratoire Pauline en cours", { text: "Faible", options: { color: C.accent, bold: true, fontSize: 8 } }, { text: "Faible", options: { color: C.accent, bold: true, fontSize: 8 } }, { text: "FAIBLE", options: { color: C.accent, bold: true, fontSize: 8 } }, "Attendre les résultats"],
  ["R5", "Instabilité cron Boucheron", { text: "Moy.", options: { color: C.orange, bold: true, fontSize: 8 } }, { text: "Élevé", options: { color: C.red, bold: true, fontSize: 8 } }, { text: "CRITIQUE", options: { color: C.red, bold: true, fontSize: 8 } }, "Monitoring renforcé post-MEP"],
  ["R6", "Cluster anomalies (session Sophie)", { text: "Moy.", options: { color: C.orange, bold: true, fontSize: 8 } }, { text: "Moyen", options: { color: C.orange, bold: true, fontSize: 8 } }, { text: "MODÉRÉ", options: { color: C.orange, bold: true, fontSize: 8 } }, "Analyse cause racine"],
];
s8r.addTable(riskRows, { x: 0.3, y: 1.2, w: 9.4, fontSize: 8, fontFace: "Calibri", color: C.text, border: { pt: 0.5, color: "E2E8F0" }, colW: [0.4, 2.8, 0.9, 0.9, 1.1, 2.3], autoPage: false, align: "center", valign: "middle" });

// Risk summary
s8r.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.0, w: 9, h: 0.5, fill: { color: "FEF2F2" } });
s8r.addText("3 risques critiques identifiés. Acceptation formelle requise par les parties prenantes avant MEP.", { x: 0.7, y: 4.0, w: 8.6, h: 0.5, fontSize: 10, fontFace: "Calibri", color: "991B1B", valign: "middle", margin: 0, bold: true });

// ================================================================
// SLIDE 9: RECOMMANDATIONS
// ================================================================
let s9r = pres.addSlide();
s9r.background = { color: C.light };

s9r.addText("Recommandations", { x: 0.5, y: 0.3, w: 6, h: 0.5, fontSize: 28, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });
s9r.addText("Lessons Learned — LEAN Kaizen / ITIL CSI", { x: 0.5, y: 0.75, w: 6, h: 0.3, fontSize: 10, fontFace: "Calibri", color: C.gray, margin: 0 });

// 4 action cards in 2x2 grid
const actions = [
  { title: "Muda — Gaspillage", icon: "1", desc: "Revue de testabilité avant chaque campagne. Formaliser les critères d'acceptation des cas de test.", priority: "Haute", pColor: C.red },
  { title: "Mura — Irrégularité", icon: "2", desc: "Processus Change Management (CAB) pour les modifications de processus automatisés.", priority: "Haute", pColor: C.red },
  { title: "Jidoka — Qualité intégrée", icon: "3", desc: "Renforcer les tests shift-left : revues de code et tests unitaires plus tôt dans le cycle.", priority: "Moyenne", pColor: C.orange },
  { title: "Heijunka — Lissage", icon: "4", desc: "Répartir la charge de test : max 30 tests par run pour un suivi plus granulaire.", priority: "Moyenne", pColor: C.orange },
];

actions.forEach((a, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = 0.5 + col * 4.6;
  const y = 1.2 + row * 1.5;

  s9r.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.3, h: 1.3, fill: { color: C.white }, shadow: mkShadow() });
  s9r.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.07, h: 1.3, fill: { color: C.accent } });

  s9r.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.12, w: 0.35, h: 0.35, fill: { color: C.accent } });
  s9r.addText(a.icon, { x: x + 0.2, y: y + 0.12, w: 0.35, h: 0.35, fontSize: 14, fontFace: "Calibri", bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });

  s9r.addText(a.title, { x: x + 0.65, y: y + 0.1, w: 2.5, h: 0.3, fontSize: 11, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });
  s9r.addText(a.priority, { x: x + 3.2, y: y + 0.12, w: 0.9, h: 0.25, fontSize: 8, fontFace: "Calibri", bold: true, color: a.pColor, align: "center", valign: "middle", fill: { color: a.pColor === C.red ? "FEE2E2" : "FEF3C7" } });

  s9r.addText(a.desc, { x: x + 0.2, y: y + 0.5, w: 3.9, h: 0.7, fontSize: 9, fontFace: "Calibri", color: C.darkGray, valign: "top", margin: 0 });
});

// Points positifs
s9r.addText("Points positifs", { x: 0.5, y: 4.3, w: 4, h: 0.35, fontSize: 14, fontFace: "Calibri", bold: true, color: C.green, margin: 0 });
s9r.addText([
  { text: "Taux d'exécution excellent (98,8%)", options: { bullet: true, fontSize: 9, breakLine: true } },
  { text: "0% de tests bloqués — environnement stable", options: { bullet: true, fontSize: 9, breakLine: true } },
  { text: "Tendance positive : runs tardifs à 100% de succès", options: { bullet: true, fontSize: 9, breakLine: true } },
  { text: "TNR par domaine — bonne granularité de suivi", options: { bullet: true, fontSize: 9 } },
], { x: 0.5, y: 4.65, w: 9, h: 0.8, fontFace: "Calibri", color: C.text, valign: "top" });

// ================================================================
// SLIDE 10: CONCLUSION / SIGNATURES
// ================================================================
let s10 = pres.addSlide();
s10.background = { color: C.navy };

s10.addText("Conclusion", { x: 0.5, y: 0.5, w: 9, h: 0.7, fontSize: 36, fontFace: "Calibri", bold: true, color: C.white, align: "center", margin: 0 });

// Decision box
s10.addShape(pres.shapes.RECTANGLE, { x: 2, y: 1.5, w: 6, h: 1.2, fill: { color: C.blue } });
s10.addText("GO SOUS RÉSERVE", { x: 2, y: 1.55, w: 6, h: 0.6, fontSize: 32, fontFace: "Calibri", bold: true, color: C.orange, align: "center", valign: "middle", margin: 0 });
s10.addText("Critères de sortie partiellement atteints — Acceptation formelle requise", { x: 2, y: 2.15, w: 6, h: 0.45, fontSize: 11, fontFace: "Calibri", color: C.ice, align: "center", valign: "middle", margin: 0 });

// Conditions
s10.addText("Conditions de mise en production :", { x: 1.0, y: 3.0, w: 8, h: 0.35, fontSize: 13, fontFace: "Calibri", bold: true, color: C.sky, margin: 0 });
s10.addText([
  { text: "Correction des 3 risques critiques (R1, R2, R5)", options: { bullet: true, fontSize: 11, color: C.ice, breakLine: true } },
  { text: "Re-test ciblé des 14 échecs du Run 1", options: { bullet: true, fontSize: 11, color: C.ice, breakLine: true } },
  { text: "Investigation TNR Tableaux de bord (0% pass rate)", options: { bullet: true, fontSize: 11, color: C.ice, breakLine: true } },
  { text: "Monitoring renforcé post-MEP sur le cron Boucheron", options: { bullet: true, fontSize: 11, color: C.ice, breakLine: true } },
  { text: "Finalisation des 2 tests WIP du Run 5", options: { bullet: true, fontSize: 11, color: C.ice } },
], { x: 1.0, y: 3.35, w: 8, h: 1.5, fontFace: "Calibri", valign: "top" });

// Footer
s10.addShape(pres.shapes.RECTANGLE, { x: 0, y: 4.8, w: 10, h: 0.825, fill: { color: C.blue } });
s10.addText("Réf. RC-R06-2026-03-27 | ISTQB CTFL v4.0 | LEAN Six Sigma | ITIL v4 CSI", { x: 0.5, y: 4.85, w: 9, h: 0.3, fontSize: 8, fontFace: "Calibri", color: C.gray, align: "center", margin: 0 });
s10.addText("QA Dashboard — Neo-Logix — 27 mars 2026", { x: 0.5, y: 5.15, w: 9, h: 0.3, fontSize: 8, fontFace: "Calibri", color: C.gray, align: "center", margin: 0 });

// ================================================================
// WRITE FILE
// ================================================================
const outPath = __dirname + "/R06_Cloture_Tests.pptx";
pres.writeFile({ fileName: outPath }).then(() => {
  // eslint-disable-next-line no-console
  console.log("PPTX generated: " + outPath);
}).catch(err => {
  console.error("Error:", err);
});
