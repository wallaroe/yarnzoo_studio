# Handover - YarnZoo Mosaic Studio

Laatst bijgewerkt: 2026-02-15
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

## 8. Mogelijke Volgende Stappen

Uit `src/YarnZoo_Roadmap.md`:
- **P2**: Text-to-grid import (plak telpatroon tekst > grid)
- **P3**: Pan navigatie (drag-to-scroll op canvas)
- **P4**: Multi-color support, pattern repeat, stitch library
- **Design**: Hover-effecten, animaties, mobile polish
