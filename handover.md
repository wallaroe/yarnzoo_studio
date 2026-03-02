# Handover - YarnZoo Mosaic Studio

Laatst bijgewerkt: 2026-03-02
Projectmap: `/Users/marccastricum/Github_local/yarnzoo_studio`
Git remote: `https://github.com/wallaroe/yarnzoo_studio.git`
Branch: `main`
Live: https://yarnzoo-studio.vercel.app

---

## 1. Huidige Status

### Deployment
- **Vercel**: Live op https://yarnzoo-studio.vercel.app
- **Vercel CLI**: Deploy via `npx vercel --prod` (geen GitHub auto-deploy, Hobby plan)
- **Env vars op Vercel**: `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` geconfigureerd
- **SPA routing**: `vercel.json` met rewrite naar `index.html`

### Login Gate
- Op Vercel (met Supabase config): login verplicht voor toegang
- Lokaal (zonder `.env`): app draait direct zonder login
- Geregeld via `hasSupabaseConfig` flag in `supabaseClient.js`
- LoginScreen in `main.jsx` met sign-in, sign-up en wachtwoord reset

### UI Redesign (2026-02-15)
Volledige redesign van sidebar-gebaseerd naar moderne layout:

- **Top bar**: Horizontale workflow stepper (Upload > Conversie > Bewerken > Patroon)
- **Bestand dropdown**: Nieuw chart, Opslaan, Instellingen, Bibliotheek, Mappen, In/Uitloggen
- **Edit stap**: 3-koloms (tools | canvas | stats met garen verbruik)
- **Pattern stap**: 3-koloms (chart previews | geschreven patroon | export/print)
- **Adjust stap**: 2-koloms (controls sidebar | previews + calculator)
- **Upload stap**: Gecentreerd, geen sidebars
- **Mobile**: Hamburger menu met volledige sidebar, inline controls per stap

### Editor Features
- Undo/Redo: Snapshot-based systeem (Cmd+Z / Cmd+Shift+Z), max 50 stappen
- Stitch statistieken: Per-kleur telling, dc/sc ratio, percentages (useMemo)
- Tools: Stokje, Wissen, Wissel
- Transformaties: Omkeren, Spiegel H, Spiegel V, Check (no-stacking validatie)
- Zoom slider
- Chart Size Calculator (swatch > gewenste maat > kolommen/rijen)
- Richting (RtoL/LtoR) en kantsteken toggle
- Garenpalet beheer (vergrendelde basiskleuren + eigen kleuren)
- Export geschreven patroon (NL/EN/DE)

---

## 2. File Structure

```
yarnzoo_studio/
├── .env                              # Supabase credentials (niet in git)
├── .env.example                      # Template
├── vercel.json                       # SPA rewrite regel
├── src/
│   ├── main.jsx                      # Entry point: LoginScreen + AuthProvider + AppWithGate
│   ├── YarnZooMosaicStudio_v3.jsx    # Hoofd-app (~3400 regels, alle UI)
│   ├── lib/
│   │   ├── supabaseClient.js         # Supabase client (graceful null bij geen config)
│   │   ├── supabase.js               # Legacy client (NIET gebruiken, throws zonder config)
│   │   ├── AuthContext.jsx            # Auth state management (React Context)
│   │   └── database.js               # CRUD operations voor charts/folders/sharing
│   └── components/
│       ├── AuthModal.jsx             # Login/Signup modal
│       ├── SaveChartModal.jsx        # Patroon opslaan dialog
│       ├── LibraryModal.jsx          # Workspace browser
│       ├── ShareModal.jsx            # Share link generator
│       └── CloudToolbar.jsx          # Cloud features toolbar
├── supabase_full_schema.sql          # Complete database schema met RLS
└── public/                           # Static assets (fonts, favicon)
```

### Belangrijk
- **supabaseClient.js** is de juiste import — geeft `null` terug zonder env vars
- **supabase.js** is legacy — throws error zonder config, NIET importeren in nieuwe code
- Alle UI zit in **YarnZooMosaicStudio_v3.jsx** — inline styles, geen CSS bestanden
- Brand kleuren in `B` constante (regel 8-23), fonts in `F` (regel 25-29)

---

## 3. Architectuur

### Auth Flow
```
main.jsx: AppWithGate
  ├── hasSupabaseConfig === false → <App /> direct (lokaal)
  ├── loading === true → <LoadingScreen />
  ├── user === null → <LoginScreen /> (sign-in/sign-up/reset)
  └── user !== null → <App />
```

### Workflow Stappen
1. **Upload**: Afbeelding uploaden of plakken
2. **Adjust (Conversie)**: Raster afmetingen, drempel, kleuren, calculator
3. **Edit (Bewerken)**: Canvas editor met tools, undo/redo, transformaties
4. **Pattern (Patroon)**: Geschreven patroon bekijken, print instellingen, export

### State Management
- Alle state in de App component via `useState`
- Auth via React Context (`AuthProvider` in `main.jsx`)
- Undo/redo via `useRef` (history stack, niet in React state)
- Stitch stats via `useMemo` (herberekend bij chart wijzigingen)
- Cloud sync via Supabase realtime (optioneel)

---

## 4. Recent Voltooide Werk

### 2026-02-15: UI Redesign
- Fase 1: Stitch statistieken berekening (useMemo)
- Fase 2-4: Top bar met stepper, Bestand dropdown, desktop sidebar verwijderd
- Fase 5: Context-afhankelijke layouts per stap (edit/pattern/adjust)
- Fase 6: Polish, build verificatie, deploy
- Fix: `React` default import toegevoegd voor `React.Fragment` in stepper

### 2026-02-15: Undo/Redo
- Snapshot-based systeem met `historyRef` en `historyIndexRef`
- Keyboard shortcuts: Cmd+Z (undo), Cmd+Shift+Z (redo)
- Knoppen in top bar (desktop) en boven canvas (mobile/edit)
- Max 50 snapshots

### 2026-02-14: Vercel Deployment + Login Gate
- Vercel CLI setup en eerste deploy
- Login gate in `main.jsx` (verplicht op Vercel, bypass lokaal)
- AuthContext fix: import van `supabaseClient` i.p.v. `supabase`

---

## 5. Git Commits (recent)

```
7cd02d9 Fix white screen: add React default import for React.Fragment
af6c24a Redesign UI with top bar stepper and context-sensitive layouts
e9f26f1 Make undo/redo buttons larger and more visible
9b418b2 Move undo/redo buttons above canvas for visibility
f23a499 Add undo/redo system to grid editor
220c255 Add login gate for Vercel deployment
80bd86f Prepare for Vercel deployment with cloud features
```

---

## 6. Lokale Development

```bash
cd /Users/marccastricum/Github_local/yarnzoo_studio
npm install
npm run dev          # Start dev server op localhost:5173
npm run build        # Productie build
npm run preview      # Test productie build lokaal
npx vercel --prod    # Deploy naar Vercel
```

---

## 7. Bekende Issues

- **Dubbele Supabase client**: `supabase.js` en `supabaseClient.js` bestaan naast elkaar. Nieuwe code moet `supabaseClient.js` gebruiken.
- **Mobile layout**: Adjust/Edit/Pattern stappen tonen controls inline op mobile. Werkt maar kan gepolijst worden.
- **Dropdown hover**: Geen hover-effect op dropdown items (inline styles ondersteunen geen :hover).

---

## 8. PDF Generatie - KRITIEKE DOCUMENTATIE

> **WAARSCHUWING**: Deze sectie documenteert cruciale bugs die veel tijd kostten om te fixen. Lees dit VOORDAT je iets aan de PDF-functionaliteit wijzigt.

### 8.1 Overzicht PDF Functies

Er zijn **twee PDF generatie functies**, maar beide MOETEN de vector-based methode gebruiken:

| Functie | Knop | Methode | Uitvoer |
|---------|------|---------|---------|
| `printChart()` | "Print / PDF (chart)" | `drawChartVectorInPDF()` | Direct PDF download |
| `generatePDF()` | "Genereer PDF" | `drawChartVectorInPDF()` | PDF met cover, patroon, chart secties |

**NIET MEER GEBRUIKEN**: `buildPrintPageImage()` - dit was de oude bitmap-methode die wazige output gaf bij inzoomen. Deze functie staat nog in de code maar wordt niet meer aangeroepen.

### 8.2 Waarom Vector Graphics?

PDFs worden door gebruikers ingezoomd tijdens het haken. Bitmap images worden wazig bij inzoomen, vector graphics blijven altijd scherp.

```
Bitmap (canvas → PNG → PDF):  Wazig bij zoom
Vector (jsPDF direct):        Altijd scherp ✓
```

### 8.3 De `drawChartVectorInPDF()` Functie

**Locatie**: `src/YarnZooMosaicStudio_v3.jsx` regel ~417

**Parameters**:
```javascript
drawChartVectorInPDF({
  doc,                    // jsPDF document instance
  chart,                  // 2D boolean array [y][x] - true = stitch
  colA, colB,            // Kleur objecten { hex, name }
  config,                // { showEdges, direction }
  startX, startY,        // Positie op pagina (mm)
  availableWidth,        // Beschikbare breedte (mm)
  availableHeight,       // Beschikbare hoogte (mm)
  startRow = 0,          // Eerste rij (voor paginering)
  endRow = null,         // Laatste rij (null = alle)
  startCol = 0,          // Eerste kolom (voor paginering)
  endCol = null,         // Laatste kolom (null = alle)
  showAllColumnNumbers = true
})
```

### 8.4 F Symbolen (Stokjes) - CRUCIALE LOGICA

**Wat zijn F symbolen?**
In overlay mosaic haakwerk markeert "F" een dubbele stokje (dc = double crochet). De chart data `chart[y][x]` geeft aan waar deze stokjes zitten.

**Hoe het werkt**:
1. `chart[y][x] === true` betekent: er is een stokje op positie (x, y)
2. De editor tekent F waar `chart[y][x]` true is
3. De PDF MOET dezelfde logica gebruiken

**KRITIEKE CODE** (rond regel 494-510):
```javascript
// Draw F symbols - scale font with cell size (no minimum threshold)
const symbolFontSize = Math.max(1.2, cellMm * 0.55 * 2.83);
doc.setTextColor(30, 30, 30);
doc.setFontSize(symbolFontSize);
doc.setFont("helvetica", "bold");
for (let gy = startRow; gy < actualEndRow; gy++) {
  for (let gx = startCol; gx < actualEndCol; gx++) {
    if (config.showEdges && (gx === 0 || gx === totalColsAll - 1)) continue;
    const patternX = gx - xOffset;
    if (patternX < 0 || patternX >= w) continue;
    if (!chart[gy] || !chart[gy][patternX]) continue;  // ← DEZE CHECK
    const cellX = offsetX + (gx - startCol) * cellMm + cellMm / 2;
    const cellY = offsetY + (gy - startRow) * cellMm + cellMm * 0.65;
    doc.text("F", cellX, cellY, { align: "center" });
  }
}
```

### 8.5 Bekende Bugs die GEFIXED zijn - NIET OPNIEUW INTRODUCEREN

#### Bug 1: Threshold die F symbolen blokkeerde
**Fout code**:
```javascript
if (cellMm >= 0.8) {  // ← FOUT: blokkeert F voor kleine cellen
  // draw F symbols
}
```
**Fix**: Verwijder de threshold, schaal de font in plaats daarvan.

#### Bug 2: Font size te groot (overflow)
**Fout code**:
```javascript
const symbolFontSize = Math.max(10, cellPx * 0.55);  // ← FOUT: 10px minimum
const symbolFontSize = Math.max(4, cellMm * 2.5);    // ← FOUT: verkeerde conversie
```
**Fix**: Correcte formule met mm → points conversie:
```javascript
const symbolFontSize = Math.max(1.2, cellMm * 0.55 * 2.83);
// 0.55 = 55% van celgrootte
// 2.83 = conversie mm naar points (72pt/inch ÷ 25.4mm/inch)
```

#### Bug 3: Odd/even rij filter
**Fout code**:
```javascript
if (rowNum % 2 === 0) continue;  // ← FOUT: de chart data bepaalt dit al
```
**Fix**: De chart data zelf bevat al de correcte stitch posities door de no-stacking constraint. Geen extra filtering nodig.

### 8.6 Font Size Formules - REFERENCE

| Element | Formule | Conversie |
|---------|---------|-----------|
| F symbool | `cellMm * 0.55 * 2.83` | 55% van cel, mm→pt |
| Rij nummers | `Math.max(1.5, Math.min(3, cellMm * 0.8))` | pt direct |
| Kolom nummers | `(cellMm / 3) * 2.83` | 3 cijfers in cel, mm→pt |

### 8.7 Paginering

Multi-page printing werkt met:
- `startRow` / `endRow` voor verticale splits
- `startCol` / `endCol` voor horizontale splits

De `printLayout` object bevat:
- `rowsPerPage`, `colsPerPage` - hoeveel cellen per pagina
- `pagesX`, `pagesY` - aantal pagina's horizontaal/verticaal
- `cellMm` - celgrootte in mm
- `totalCols` - totaal aantal kolommen incl. edges

### 8.8 Testen na Wijzigingen

**Test ALTIJD met**:
1. Klein patroon (bijv. konijn_2: 286×178)
2. Groot patroon (bijv. bordercollie: 231×231)
3. "1 pagina" mode - check F symbolen zichtbaar
4. "Meerdere pagina's" mode - check paginering correct
5. Zoom in op PDF - check scherpte
6. Vergelijk met stap 3 editor - F symbolen moeten identiek zijn

---

## 9. Mogelijke Volgende Stappen

Uit `src/YarnZoo_Roadmap.md`:
- **P2**: Text-to-grid import (plak telpatroon tekst > grid)
- **P3**: Pan navigatie (drag-to-scroll op canvas)
- **P4**: Multi-color support, pattern repeat, stitch library
- **Design**: Hover-effecten, animaties, mobile polish
