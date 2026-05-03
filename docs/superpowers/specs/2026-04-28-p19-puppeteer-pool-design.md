# Spec P19 — Pool Puppeteer optimisé

> Date : 2026-04-28  
> Scope : Refactoring du `PdfService` pour un pool de pages réutilisables, contrôle de concurrence, et métriques de génération.

---

## Contexte

Le `PdfService` actuel (`backend/services/pdf.service.ts`) gère un singleton browser Puppeteer avec recyclage global tous les 50 PDFs et un idle timeout de 10 min. Cependant :

- Chaque requête fait `browser.newPage()` puis `page.close()` (~300ms de overhead)
- Aucune limite de concurrence : N requêtes simultanées = N pages ouvertes
- Aucune métrique côté client (temps de génération inconnu)
- Aucune alerte si un PDF dépasse un seuil critique

---

## Objectifs

1. Réduire le temps de génération PDF en réutilisant des pages pré-ouvertes
2. Limiter la concurrence à 3 PDFs simultanés pour protéger la mémoire
3. Exposer le temps de génération via header HTTP `X-PDF-Generation-Time`
4. Loguer un WARN si un PDF dépasse 10s
5. Maintenir le recyclage existant (browser tous les 50 PDFs) + ajouter la rotation par page (toutes les 20 générations)

---

## Architecture

```
PdfService
├── browser: Browser           // instance Puppeteer partagée
├── pool: PagePool             // 3 slots (idle | busy)
│   ├── pages: Page[]          // pages réutilisables
│   ├── generationCount: number[] // compteur par page
│   └── maxPageGenerations: 20
├── queue: Promise<Page>[]     // FIFO d'attente
├── concurrency: number        // actuellement actifs (max 3)
├── maxConcurrency: 3
├── maxQueueSize: 5
├── acquirePage(): Promise<Page>
│   ├── si idle dispo → réinit (goto about:blank) → busy
│   ├── si full mais queue < maxQueueSize → push en FIFO
│   └── si queue full → throw 429
├── releasePage(page)
│   ├── inc generationCount[page]
│   ├── si count >= maxPageGenerations → rotatePage(page)
│   └── sinon → idle
├── rotatePage(page)
│   ├── page.close()
│   └── crée nouvelle page dans le pool
└── generateFromHTML(html, options)
    ├── const start = Date.now()
    ├── const page = await acquirePage()
    ├── try { pdf = await page.pdf(...) }
    ├── finally { releasePage(page) }
    ├── const duration = Date.now() - start
    ├── if duration > 10_000 → logger.warn(...)
    └── return { buffer: pdf, duration }
```

---

## API / Interface

### PdfService (interne)

```ts
type PDFResult = {
  buffer: Buffer;
  durationMs: number;
};

class PdfService {
  async generateFromHTML(html: string, options?: PDFOptions): Promise<PDFResult>;
  async generateDashboardPDF(metrics: DashboardMetrics, options?: PDFOptions): Promise<PDFResult>;
  async close(): Promise<void>;
}
```

### Route HTTP (`backend/routes/pdf.routes.ts`)

La route `POST /api/pdf/generate` renvoie le Buffer avec le header additionnel :

```
Content-Type: application/pdf
X-PDF-Generation-Time: 1245
```

---

## Stratégie de migration

1. **Refactor interne** : transformer `generateFromHTML` pour retourner `PDFResult` (breaking change interne, pas d'impact route)
2. **Ajout du pool** : `acquirePage` / `releasePage` avec semaphore
3. **Route** : injecte le header `X-PDF-Generation-Time`
4. **Tests** : mock du pool, test de concurrence (5 appels → max 3 actifs), test du timing

---

## Tests

| Test                  | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| `pdf.service.test.ts` | Pool : 3 pages créées au démarrage                             |
| `pdf.service.test.ts` | Concurrency : 5 appels simultanés, max 3 actifs, 2 en queue    |
| `pdf.service.test.ts` | Queue overflow : 6e appel rejetée avec erreur                  |
| `pdf.service.test.ts` | Rotation page : après 20 PDFs, la page est fermée et remplacée |
| `pdf.service.test.ts` | Timing : `durationMs` retourné et cohérent                     |
| `pdf.routes.test.ts`  | Header `X-PDF-Generation-Time` présent dans la réponse         |

---

## Fichiers impactés

- `backend/services/pdf.service.ts` — Refactor majeur (pool + semaphore)
- `backend/routes/pdf.routes.ts` — Ajout du header
- `backend/tests/services/pdf.service.test.ts` — Nouveaux tests
- `backend/tests/integration/pdf.routes.test.ts` — Test du header

---

## Non-goals (hors scope)

- Ne pas toucher aux templates HTML/CSS des rapports
- Ne pas ajouter de cache Redis ou disque pour les PDFs
- Ne pas changer le format de sortie (Buffer PDF)

---

## Dépendances

Aucune dépendance npm supplémentaire. Utilise `puppeteer` déjà installé.
