import {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
    PageBreak
} from 'docx';

// ─── Helpers ────────────────────────────────────────────────────────────────

const COLORS = {
    green:  '10B981',
    red:    'EF4444',
    orange: 'F59E0B',
    blue:   '3B82F6',
    gray:   '6B7280',
    lightGray: 'F3F4F6',
    darkGray: '374151',
    white:  'FFFFFF',
    black:  '111827',
};

const SLA = {
    completionRate: 90,
    passRate:       80,
    failureRate:    20,
    blockedRate:     5,
};

function criteriaMet(value, threshold, isMax = false) {
    return isMax ? value <= threshold : value >= threshold;
}

function statusSymbol(ok) {
    return ok ? '✓' : '✗';
}

function statusColor(ok) {
    return ok ? COLORS.green : COLORS.red;
}

function bold(text, color?) {
    return new TextRun({ text, bold: true, color: color || COLORS.black });
}

function italic(text, color?) {
    return new TextRun({ text, italics: true, color: color || COLORS.gray });
}

function h1(text) {
    return new Paragraph({
        children: [
            new TextRun({ text, bold: true, size: 26, color: COLORS.darkGray }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        border: {
            bottom: { color: COLORS.blue, size: 6, space: 1, style: BorderStyle.SINGLE }
        }
    });
}

function h2(text) {
    return new Paragraph({
        children: [new TextRun({ text, bold: true, size: 22, color: COLORS.darkGray })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 140 }
    });
}

function bullet(label, value, valueColor?) {
    return new Paragraph({
        children: [
            new TextRun({ text: '• ', color: COLORS.blue }),
            bold(label + ' : '),
            new TextRun({ text: value, color: valueColor || COLORS.black }),
        ],
        spacing: { before: 80, after: 80 },
        indent: { left: 360 }
    });
}

function placeholder(text) {
    return new Paragraph({
        children: [italic(`[ ${text} ]`, COLORS.gray)],
        spacing: { before: 80, after: 80 },
        indent: { left: 360 }
    });
}

function emptyLine() {
    return new Paragraph({ text: '', spacing: { before: 100, after: 100 } });
}

function pageBreak() {
    return new Paragraph({ children: [new PageBreak()] });
}

// Tableau 2 colonnes simple
function twoColTable(rows) {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top:    { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
            left:   { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
            right:  { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
            insideHorizontal:{ style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
            insideVertical:{ style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
        },
        rows: rows.map(([label, value, valueColor, isHeader], idx) => {
            const bg = isHeader ? COLORS.blue : (idx % 2 === 0 ? COLORS.white : COLORS.lightGray);
            const fgLabel = isHeader ? COLORS.white : COLORS.darkGray;
            const fgValue = isHeader ? COLORS.white : (valueColor || COLORS.black);
            return new TableRow({
                children: [
                    new TableCell({
                        width: { size: 55, type: WidthType.PERCENTAGE },
                        shading: { fill: bg, type: ShadingType.CLEAR },
                        children: [new Paragraph({
                            children: [new TextRun({ text: label, bold: isHeader, color: fgLabel })],
                            spacing: { before: 80, after: 80 },
                            indent: { left: 120 }
                        })]
                    }),
                    new TableCell({
                        width: { size: 45, type: WidthType.PERCENTAGE },
                        shading: { fill: bg, type: ShadingType.CLEAR },
                        children: [new Paragraph({
                            children: [new TextRun({ text: value, bold: isHeader, color: fgValue })],
                            spacing: { before: 80, after: 80 },
                            alignment: AlignmentType.CENTER,
                        })]
                    }),
                ]
            });
        })
    });
}

// ─── Générateur Principal ────────────────────────────────────────────────────

export const generateQuickClosureDoc = async ({
    currentMetrics,
    selectedPastRuns,
    project,
    environment,
    startDate,
    endDate,
    bugs
}) => {
    const rates    = currentMetrics.qualityRates || { detectionRate: 0, bugsInTest: 0, bugsInProd: 0, totalBugs: 0, escapeRate: 0 };
    const raw      = currentMetrics.raw || { total: 0, passed: 0, failed: 0, untested: 0, blocked: 0, skipped: 0, completed: 0, retest: 0, wip: 0 };
    const execRate = currentMetrics.completionRate || 0;
    const passRate = currentMetrics.passRate       || 0;
    const failRate = currentMetrics.failureRate    || 0;
    const blockRate= currentMetrics.blockedRate    || 0;
    const efficiency = currentMetrics.testEfficiency || 0;
    const milestoneName = currentMetrics.preprodMilestone || currentMetrics.preprodMilestoneName || 'N/A';
    const runs = currentMetrics.runs || [];

    // Évaluation des critères de sortie
    const criteriaExec    = criteriaMet(execRate,  SLA.completionRate);
    const criteriaPass    = criteriaMet(passRate,  SLA.passRate);
    const criteriaFail    = criteriaMet(failRate,  SLA.failureRate, true);
    const criteriaBlock   = criteriaMet(blockRate, SLA.blockedRate,  true);
    const validBugs       = (bugs || []).filter(b => b.desc && b.desc.trim() !== '');
    const criteriaCritical = validBugs.filter(b => b.severity === 'Critique').length === 0;
    const allCriteriaMet  = criteriaExec && criteriaPass && criteriaFail && criteriaBlock && criteriaCritical;
    const goNoGo          = allCriteriaMet ? 'GO ✓' : 'NO-GO ✗';
    const goNoGoColor     = allCriteriaMet ? COLORS.green : COLORS.red;

    const projectName = project?.name || 'Projet';
    const today = new Date().toLocaleDateString('fr-FR');

    const children = [];

    // ═══════════════════════════════════════════════════════
    // PAGE DE GARDE
    // ═══════════════════════════════════════════════════════

    children.push(
        new Paragraph({ text: '', spacing: { before: 800 } }),
        new Paragraph({
            children: [new TextRun({ text: 'RAPPORT DE CLÔTURE DE TEST', bold: true, size: 52, color: COLORS.blue })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 }
        }),
        new Paragraph({
            children: [new TextRun({ text: 'Norme ISTQB – Test Closure Report', size: 28, color: COLORS.gray, italics: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 600 }
        }),
        new Paragraph({ text: '', spacing: { before: 200, after: 200 } }),
        twoColTable([
            ['Champ', 'Valeur', null, true],
            ['Projet', projectName],
            ['Jalons / Campagne', milestoneName],
            ['Environnement', environment || 'Non spécifié'],
            ['Période de test', `${startDate || 'N/A'}  →  ${endDate || 'N/A'}`],
            ['Date d\'édition', today],
            ['Auteur', 'QA Lead – Neo-Logix'],
            ['Référentiel', 'ISTQB Foundation Level v4.0'],
        ]),
        pageBreak()
    );

    // ═══════════════════════════════════════════════════════
    // SECTION 1 — PÉRIMÈTRE DES TESTS
    // ═══════════════════════════════════════════════════════

    children.push(h1('1. Périmètre des Tests'));

    children.push(h2('1.1 Ce qui a été testé'));
    children.push(
        bullet('Jalons couverts', milestoneName),
        bullet('Nombre de runs / sessions inclus', `${currentMetrics.runsCount || runs.length}`),
        bullet('Environnement de test', environment || 'Non spécifié'),
    );

    if (runs.length > 0) {
        children.push(emptyLine());
        const runRows = [
            ['Run / Session', 'Total', 'Exécutés', 'Succès', 'Échecs', 'Taux exec.', true]
        ];
        runs.forEach(r => {
            runRows.push([
                r.name || '—',
                String(r.total || 0),
                String(r.completed || 0),
                String(r.passed || 0),
                String(r.failed || 0),
                `${r.completionRate || 0}%`,
            ]);
        });
        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top:    { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
                left:   { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
                right:  { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
                insideHorizontal:{ style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
                insideVertical:{ style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
            },
            rows: runRows.map(([col1, col2, col3, col4, col5, col6, isHeader], idx) => {
                const bg = isHeader ? COLORS.blue : (idx % 2 === 0 ? COLORS.white : COLORS.lightGray);
                const fg = isHeader ? COLORS.white : COLORS.darkGray;
                return new TableRow({
                    children: [col1, col2, col3, col4, col5, col6].map(val => new TableCell({
                        shading: { fill: bg, type: ShadingType.CLEAR },
                        children: [new Paragraph({
                            children: [new TextRun({ text: String(val), bold: !!isHeader, color: fg })],
                            spacing: { before: 60, after: 60 },
                            indent: { left: 80 }
                        })]
                    }))
                });
            })
        }));
    }

    children.push(emptyLine(), h2('1.2 Ce qui n\'a pas été testé'));
    children.push(
        bullet('Tests non exécutés', `${raw.untested || 0} cas`),
        placeholder('Préciser les fonctionnalités exclues du périmètre et la justification (hors scope, risque accepté, manque de temps, etc.)'),
    );

    children.push(pageBreak());

    // ═══════════════════════════════════════════════════════
    // SECTION 2 — RÉSULTATS D'EXÉCUTION
    // ═══════════════════════════════════════════════════════

    children.push(h1('2. Résultats d\'Exécution'));

    children.push(h2('2.1 Volumes de tests'));
    children.push(
        twoColTable([
            ['Indicateur', 'Valeur', null, true],
            ['Total cas de test prévus', `${raw.total || 0}`],
            ['Cas exécutés',            `${raw.completed || 0}`],
            ['Cas non exécutés',        `${raw.untested  || 0}`],
            ['Succès (Passed)',          `${raw.passed    || 0}`, COLORS.green],
            ['Échecs (Failed)',          `${raw.failed    || 0}`, COLORS.red],
            ['Bloqués (Blocked)',        `${raw.blocked   || 0}`, COLORS.orange],
            ['En cours (WIP)',           `${raw.wip       || 0}`, COLORS.blue],
            ['Ignorés (Skipped)',        `${raw.skipped   || 0}`, COLORS.gray],
        ])
    );

    children.push(emptyLine(), h2('2.2 Indicateurs ISTQB'));
    children.push(
        twoColTable([
            ['Indicateur', 'Valeur obtenue', null, true],
            ['Taux d\'Exécution',       `${execRate}%`,   execRate  >= SLA.completionRate ? COLORS.green : COLORS.red],
            ['Taux de Succès',          `${passRate}%`,   passRate  >= SLA.passRate       ? COLORS.green : COLORS.red],
            ['Taux d\'Échec',           `${failRate}%`,   failRate  <= SLA.failureRate    ? COLORS.green : COLORS.red],
            ['Taux de Blocage',         `${blockRate}%`,  blockRate <= SLA.blockedRate    ? COLORS.green : COLORS.red],
            ['Taux de Détection (DDP)',    `${rates.detectionRate || 0}%`, (rates.detectionRate || 0) >= 80 ? COLORS.green : COLORS.orange],
            ['Taux d\'Échappement (ER)',   `${rates.escapeRate    || 0}%`, (rates.escapeRate    || 0) <= 10 ? COLORS.green : COLORS.red],
            ['Bugs détectés en test',      `${rates.bugsInTest    || 0}`],
            ['Bugs détectés en production',`${rates.bugsInProd    || 0}`, (rates.bugsInProd || 0) === 0 ? COLORS.green : COLORS.red],
            ['Efficience des tests',       `${efficiency}%`],
        ])
    );

    children.push(pageBreak());

    // ═══════════════════════════════════════════════════════
    // SECTION 3 — ÉVALUATION DES CRITÈRES DE SORTIE
    // ═══════════════════════════════════════════════════════

    children.push(h1('3. Évaluation des Critères de Sortie'));

    children.push(new Paragraph({
        children: [italic('Seuils définis selon la politique SLA en vigueur (ISTQB – Exit Criteria).')],
        spacing: { before: 80, after: 200 }
    }));

    children.push(
        twoColTable([
            ['Critère de Sortie', 'Résultat', null, true],
            [
                `Taux d'Exécution ≥ ${SLA.completionRate}%  (obtenu : ${execRate}%)`,
                statusSymbol(criteriaExec),
                statusColor(criteriaExec)
            ],
            [
                `Taux de Succès ≥ ${SLA.passRate}%  (obtenu : ${passRate}%)`,
                statusSymbol(criteriaPass),
                statusColor(criteriaPass)
            ],
            [
                `Taux d'Échec ≤ ${SLA.failureRate}%  (obtenu : ${failRate}%)`,
                statusSymbol(criteriaFail),
                statusColor(criteriaFail)
            ],
            [
                `Taux de Blocage ≤ ${SLA.blockedRate}%  (obtenu : ${blockRate}%)`,
                statusSymbol(criteriaBlock),
                statusColor(criteriaBlock)
            ],
            [
                'Aucune anomalie critique ouverte',
                statusSymbol(criteriaCritical),
                statusColor(criteriaCritical)
            ],
        ])
    );

    children.push(emptyLine());

    if (!allCriteriaMet) {
        children.push(
            new Paragraph({
                children: [
                    bold('Critères non atteints – Justification / Risque accepté :'),
                ],
                spacing: { before: 160, after: 80 }
            }),
            placeholder('Décrire la décision consciente d\'accepter le risque résiduel (raison planning/budget/métier) et qui l\'a validée.')
        );
    }

    children.push(emptyLine());

    // ═══════════════════════════════════════════════════════
    // SECTION 4 — ÉTAT DES ANOMALIES
    // ═══════════════════════════════════════════════════════

    children.push(h1('4. État des Anomalies'));

    children.push(h2('4.1 Anomalies critiques / majeures ouvertes'));

    if (validBugs.length > 0) {
        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top:    { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
                left:   { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
                right:  { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
                insideHorizontal:{ style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
                insideVertical:{ style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            shading: { fill: COLORS.blue, type: ShadingType.CLEAR },
                            width: { size: 15, type: WidthType.PERCENTAGE },
                            children: [new Paragraph({ children: [new TextRun({ text: 'Sévérité', bold: true, color: COLORS.white })], spacing: { before: 80, after: 80 }, indent: { left: 80 } })]
                        }),
                        new TableCell({
                            shading: { fill: COLORS.blue, type: ShadingType.CLEAR },
                            width: { size: 85, type: WidthType.PERCENTAGE },
                            children: [new Paragraph({ children: [new TextRun({ text: 'Description / Référence ticket', bold: true, color: COLORS.white })], spacing: { before: 80, after: 80 }, indent: { left: 80 } })]
                        }),
                    ]
                }),
                ...validBugs.map((b, idx) => new TableRow({
                    children: [
                        new TableCell({
                            shading: { fill: idx % 2 === 0 ? COLORS.white : COLORS.lightGray, type: ShadingType.CLEAR },
                            children: [new Paragraph({ children: [new TextRun({ text: b.severity, bold: true, color: b.severity === 'Critique' ? COLORS.red : COLORS.orange })], spacing: { before: 80, after: 80 }, indent: { left: 80 } })]
                        }),
                        new TableCell({
                            shading: { fill: idx % 2 === 0 ? COLORS.white : COLORS.lightGray, type: ShadingType.CLEAR },
                            children: [new Paragraph({ children: [new TextRun({ text: b.desc, color: COLORS.darkGray })], spacing: { before: 80, after: 80 }, indent: { left: 80 } })]
                        }),
                    ]
                }))
            ]
        }));
    } else {
        children.push(new Paragraph({
            children: [new TextRun({ text: 'Aucune anomalie critique ou majeure ouverte.', color: COLORS.green, bold: true })],
            spacing: { before: 100, after: 100 },
            indent: { left: 360 }
        }));
    }

    children.push(emptyLine(), h2('4.2 Synthèse des anomalies'));
    children.push(
        twoColTable([
            ['Indicateur', 'Valeur', null, true],
            ['Bugs détectés en test (DDP)',          `${rates.bugsInTest || 0}`],
            ['Bugs détectés en production (ER)',     `${rates.bugsInProd || 0}`, (rates.bugsInProd || 0) === 0 ? COLORS.green : COLORS.red],
            ['Total bugs',                           `${rates.totalBugs  || 0}`],
            ['Taux de Détection (DDP)',              `${rates.detectionRate || 0}%`, (rates.detectionRate || 0) >= 80 ? COLORS.green : COLORS.orange],
            ['Taux d\'Échappement (ER)',             `${rates.escapeRate    || 0}%`, (rates.escapeRate    || 0) <= 10 ? COLORS.green : COLORS.red],
        ])
    );
    children.push(
        emptyLine(),
        placeholder('Préciser les anomalies résolues, leur nature et les corrections apportées avant mise en production.'),
    );

    children.push(pageBreak());

    // ═══════════════════════════════════════════════════════
    // SECTION 5 — RISQUES RÉSIDUELS
    // ═══════════════════════════════════════════════════════

    children.push(h1('5. Risques Résiduels'));

    children.push(new Paragraph({
        children: [italic('Identifier les zones de risque non couvertes ou partiellement testées.')],
        spacing: { before: 80, after: 200 }
    }));

    children.push(twoColTable([
        ['Zone de risque', 'Niveau / Commentaire', null, true],
        ['Fonctionnalités non testées', ''],
        ['Régressions potentielles',   ''],
        ['Risques d\'environnement',   ''],
        ['Risques de données de test', ''],
    ]));

    children.push(
        emptyLine(),
        placeholder('Décrire chaque risque résiduel identifié, son niveau (Faible / Moyen / Élevé) et les mesures de mitigation proposées.'),
    );

    children.push(emptyLine());

    // ═══════════════════════════════════════════════════════
    // SECTION 6 — DÉCISION GO / NO-GO
    // ═══════════════════════════════════════════════════════

    children.push(h1('6. Décision de Mise en Production (Go / No-Go)'));

    children.push(new Paragraph({
        children: [
            bold('Recommandation automatique basée sur les critères de sortie : '),
            new TextRun({ text: goNoGo, bold: true, size: 28, color: goNoGoColor }),
        ],
        spacing: { before: 160, after: 200 }
    }));

    children.push(
        twoColTable([
            ['Critère de sortie global', `${allCriteriaMet ? 'Tous les critères sont atteints.' : 'Un ou plusieurs critères ne sont pas atteints.'}`, allCriteriaMet ? COLORS.green : COLORS.red, true],
        ])
    );

    children.push(
        emptyLine(),
        new Paragraph({ children: [bold('Décision finale validée par le QA Lead :')], spacing: { before: 160, after: 80 } }),
        placeholder('GO / GO avec réserves / NO-GO — Préciser la décision officielle et le nom du responsable.'),
        emptyLine(),
        new Paragraph({ children: [bold('Justification :')], spacing: { before: 120, after: 80 } }),
        placeholder('Décrire le contexte de la décision : planning, budget, risque accepté, contraintes métier, etc.'),
    );

    children.push(pageBreak());

    // ═══════════════════════════════════════════════════════
    // SECTION 7 — RETOUR D'EXPÉRIENCE (REX)
    // ═══════════════════════════════════════════════════════

    children.push(h1('7. Retour d\'Expérience (REX – Lessons Learned)'));

    children.push(new Paragraph({
        children: [italic('ISTQB : l\'analyse post-test vise à améliorer le processus pour les campagnes futures.')],
        spacing: { before: 80, after: 200 }
    }));

    children.push(h2('7.1 Ce qui a bien fonctionné'));
    children.push(placeholder('Lister les pratiques, outils ou décisions qui ont contribué positivement à la campagne (ex : automatisation, bonne couverture, réactivité équipe dev, etc.).'));

    children.push(emptyLine(), h2('7.2 Ce qui n\'a pas fonctionné'));
    children.push(placeholder('Lister les points d\'amélioration : blocages récurrents, manque de données de test, couverture insuffisante, délais non tenus, communication, etc.'));

    children.push(emptyLine(), h2('7.3 Actions d\'amélioration proposées'));
    children.push(
        twoColTable([
            ['Action d\'amélioration', 'Responsable / Échéance', null, true],
            ['', ''],
            ['', ''],
            ['', ''],
        ])
    );
    children.push(placeholder('Compléter le tableau avec les actions issues du REX.'));

    children.push(pageBreak());

    // ═══════════════════════════════════════════════════════
    // SECTION 8 — ARCHIVAGE DU TESTWARE
    // ═══════════════════════════════════════════════════════

    children.push(h1('8. Archivage du Testware'));

    children.push(new Paragraph({
        children: [italic('ISTQB : tous les artefacts de test doivent être archivés, versionnés et accessibles pour la maintenance et les audits.')],
        spacing: { before: 80, after: 200 }
    }));

    children.push(twoColTable([
        ['Artefact', 'Statut / Localisation', null, true],
        ['Plan de test',                    ''],
        ['Cas de test (Testmo)',             `Projet : ${projectName} – Jalon : ${milestoneName}`],
        ['Scripts d\'automatisation',       ''],
        ['Jeux de données de test',         ''],
        ['Rapports d\'exécution (Testmo)',  `Environnement : ${environment || 'N/A'}`],
        ['Rapports d\'anomalies',           ''],
        ['Preuves d\'exécution (captures)', ''],
        ['Présent rapport de clôture',      `Généré le ${today}`],
    ]));

    children.push(
        emptyLine(),
        placeholder('Confirmer que les artefacts sont correctement versionnés et accessibles à l\'équipe.')
    );

    children.push(emptyLine());

    // ═══════════════════════════════════════════════════════
    // SECTION 9 — RECOMMANDATIONS
    // ═══════════════════════════════════════════════════════

    children.push(h1('9. Recommandations pour la Prochaine Campagne'));

    children.push(twoColTable([
        ['Domaine', 'Recommandation', null, true],
        ['Stratégie de test',          ''],
        ['Critères d\'entrée / sortie', ''],
        ['Couverture de tests',        ''],
        ['Automatisation',             ''],
        ['Environnement / données',    ''],
        ['Communication équipe',       ''],
    ]));

    children.push(
        emptyLine(),
        placeholder('Compléter chaque ligne avec une recommandation actionnable pour la prochaine release.')
    );

    children.push(pageBreak());

    // ═══════════════════════════════════════════════════════
    // SECTION 10 — EFFICIENCE LEAN
    // ═══════════════════════════════════════════════════════

    children.push(h1('10. Efficience (LEAN)'));

    children.push(
        bullet('Efficience globale des tests', `${efficiency}%`, efficiency >= 80 ? COLORS.green : COLORS.orange),
        emptyLine()
    );

    if (selectedPastRuns && selectedPastRuns.length > 0) {
        const totBugsTest  = selectedPastRuns.reduce((acc, r) => acc + (r.bugsInTest  || 0), 0);
        const totBugsProd  = selectedPastRuns.reduce((acc, r) => acc + (r.bugsInProd  || 0), 0);
        const runsNames    = selectedPastRuns.map(r => r.version).join(' + ');
        const totalBugs    = totBugsTest + totBugsProd;
        const ddpConsolidated = totalBugs > 0 ? Math.round((totBugsTest / totalBugs) * 100) : 100;

        children.push(h2('10.1 Consolidation des campagnes historiques'));
        children.push(
            twoColTable([
                ['Indicateur consolidé', 'Valeur', null, true],
                ['Versions fusionnées',         runsNames],
                ['Total bugs détectés en test',  `${totBugsTest}`],
                ['Total bugs détectés en prod',  `${totBugsProd}`],
                ['DDP Consolidé',               `${ddpConsolidated}%`, ddpConsolidated >= 80 ? COLORS.green : COLORS.red],
            ])
        );
    } else {
        children.push(new Paragraph({
            children: [italic('Aucune campagne historique sélectionnée pour consolidation.')],
            spacing: { before: 80, after: 80 },
            indent: { left: 360 }
        }));
    }

    // ═══════════════════════════════════════════════════════
    // PIED DE PAGE
    // ═══════════════════════════════════════════════════════

    children.push(
        emptyLine(),
        new Paragraph({
            children: [new TextRun({ text: '─'.repeat(80), color: COLORS.gray })],
            spacing: { before: 400, after: 200 }
        }),
        new Paragraph({
            children: [
                italic(`Document généré le ${today} par le QA Dashboard Neo-Logix  •  Norme ISTQB Foundation Level v4.0  •  Projet : ${projectName}  •  Campagne : ${milestoneName}`)
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 80 }
        })
    );

    // ─── Assemblage final ─────────────────────────────────

    const doc = new Document({
        creator: 'QA Dashboard – Neo-Logix',
        title: `Rapport de Clôture – ${projectName} – ${milestoneName}`,
        description: 'Rapport de clôture de test conforme ISTQB',
        sections: [{
            properties: {
                page: {
                    margin: { top: 900, right: 900, bottom: 900, left: 900 }
                }
            },
            children: children
        }]
    });

    return Packer.toBlob(doc);
};
