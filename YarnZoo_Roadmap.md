# YarnZoo — Roadmap & Projectplan

## Huidige situatie

Je workflow voor een nieuw haakpatroon ziet er nu zo uit:

1. Inspiratie → rastertekening uitwerken
2. Stitchfiddle → teltekening + geschreven patroon
3. **Handmatig in InDesign** → opmaken in huisstijl, per taal (NL/EN/DE)
4. Exporteren als PDF → plaatsen op Shopify, Ravelry, Etsy

Stap 3 is het grootste knelpunt: bij 3-5 patronen per maand kost dit veel tijd, vooral door meertaligheid en tekstlengte-verschillen per taal.

---

## De oplossing: PDF-generator in Mosaic Studio

**Gekozen route:** Een eigen PDF-generator die volledig geïntegreerd is in de Mosaic Studio. Eén klik genereert een compleet patroon-PDF in je huisstijl, in de gewenste taal.

### Waarom deze route?

| Criterium | InDesign + script | Eigen PDF-generator | HTML template |
|-----------|:-:|:-:|:-:|
| Snelheid per patroon | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Flexibiliteit layout | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Kosten | ⭐ (abonnement) | ⭐⭐⭐ (gratis) | ⭐⭐⭐ (gratis) |
| Toekomstbestendig | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| Meertalig | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

**Conclusie:** De structuur van YarnZoo-patronen is voorspelbaar genoeg (vaste pagina-types, altijd 2 kleuren, herhalende huisstijl-elementen) om volledig te automatiseren zonder visuele editor.

---

## Fase 1 — Proof of Concept PDF-generator

**Doel:** Het "Kleine Boerderij Speelkleed" patroon exact nabouwen als automatisch gegenereerde PDF, ononderscheidbaar van de InDesign-versie.

### Huisstijl-elementen

- **Fonts:** Oranje rounded bold koppen, schreefloos voor broodtekst
- **Logo:** YarnZoo olifant-in-cirkel, op cover en tussenpagina's
- **Decoratie:** Groene bladeren linksonder, dunne oranje lijn bovenaan
- **Footer:** Copyright-tekst + paginanummer op elke pagina
- **Achtergrond:** Warm crème/wit

### Pagina-types

| Type | Inhoud | Variabel per patroon |
|------|--------|:---:|
| **Cover** | Full-bleed foto, patroonnaam, logo | ✅ |
| **Introductie** | Verhaaltekst, materiaallijst, uitleg symbolen | ✅ |
| **Geschreven patroon** | Rij-voor-rij instructies (bulk) | ✅ |
| **Telpatroon (delen)** | Chart in leesbare delen | ✅ |
| **Telpatroon (totaal)** | Volledige chart overzicht | ✅ |
| **Afwerking** | Enveloprand instructies | ✅ (tekst varieert) |
| **Foto-pagina** | Optionele extra foto('s) tussendoor | ✅ (optioneel) |
| **Promo** | Andere YarnZoo boeken | ❌ (altijd hetzelfde) |

### Deliverables fase 1

- [ ] PDF die visueel identiek is aan de InDesign-versie
- [ ] Correcte paginanummering, headers, footers
- [ ] Telpatroon-charts in kleur met rijnummers
- [ ] Alle huisstijl-elementen (bladeren, logo, oranje lijnen)

---

## Fase 2 — Koppeling met Mosaic Studio

**Doel:** De PDF-generator haalt alle data direct uit de Mosaic Studio.

### Invoer vanuit de app

- Patroonnaam
- Kleurnamen + hex-codes (altijd 2 kleuren)
- Coverfoto (upload)
- Intro-tekst (kort verhaal)
- Materiaallijst (garen, naald, etc.)
- Afwerkingsinstructies
- Optionele extra foto-pagina's (positie kiezen)

### Automatisch gegenereerd

- Geschreven patroon (rij-voor-rij uit het grid)
- Telpatroon-charts (uit het grid, in delen + totaal)
- Uitleg symbolen (met juiste kleuren)
- Startinstructies (lossenketting berekend uit grid-breedte)
- Paginanummering en layout

---

## Fase 3 — Meertalig (NL / EN / DE)

**Doel:** Eén klik wisselt de taal, PDF wordt opnieuw gegenereerd.

### Wat wordt automatisch vertaald

| Element | NL | EN | DE |
|---------|----|----|-----|
| Steek-afkortingen | v / st / KS | sc / dc / es | fM / Stb / RS |
| Vaste teksten | "vaste in achterste lus" | "single crochet in back loop" | "feste Masche in hinteres Maschenglied" |
| Symbool-uitleg | Automatisch per taal | ✅ | ✅ |
| Copyright | © 2025 YarnZoo... | ✅ (vertaald) | ✅ (vertaald) |
| Enveloprand | Standaard NL tekst | Vertaald | Vertaald |

### Wat je zelf vertaalt

- Patroonnaam
- Intro-tekst (verhaal)
- Materiaallijst (garennamen zijn internationaal, maar context kan verschillen)

### Aandachtspunten

- Duitse patronen worden langer door langere haaktermen → automatische paginering
- Geschreven patroon past zich automatisch aan (v→sc→fM, st→dc→Stb)

---

## Mosaic Studio — Wat moet nog afgebouwd worden

Naast de PDF-generator zijn er nog onderdelen van de Mosaic Studio zelf die aandacht nodig hebben.

### Prioriteit 1 — Kernfunctionaliteit (moet werken voor PDF)

- [x] **Steek-chart correctheid:** Stokje-op-stokje validatie (no-stacking) moet 100% betrouwbaar zijn ✅ `validateNoStacking()` in v3
- [x] **Geschreven patroon generatie:** Correcte output van rij-instructies met kantsteek, in het juiste formaat ✅ `generateWrittenPattern()` NL/EN/DE
- [x] **Telpatroon-chart export:** Chart als afbeelding genereren met rijnummers, kleuren, en steek-symbolen ✅ ChartCanvas + VisualPreview
- [x] **Chart opsplitsing:** Automatisch opdelen in leesbare delen (zoals in je huidige patronen: 3 secties + totaal) ✅ Drie modi: gelijke delen, vaste rij-grootte, handmatig

### Prioriteit 2 — Gebruiksvriendelijkheid

- [x] **Image-to-grid verbetering:** Betere drempelwaarde-controle, preview voor/na ✅ Adjust stap met slider + live preview
- [x] **Grid editor:** Vlot tekenen, wissen, spiegelen — moet soepel werken op grote grids (140x140) ✅ Canvas-based editor met tools
- [x] **Opslaan/laden:** Projecten opslaan en later hervatten (Supabase integratie werkt al) ✅ Lokaal + cloud via Supabase
- [x] **Undo/redo:** Essentieel bij het handmatig bewerken van grote grids ✅ Snapshot-based, max 50, Cmd+Z/Cmd+Shift+Z

### Prioriteit 3 — Kwaliteit van leven

- [x] **Meerdere kleuren preview:** Visuele preview die laat zien hoe het gehaakt eruitziet (overlay-effect) ✅ VisualPreview component
- [ ] **Grid importeren vanuit geschreven patroon:** Bestaande patronen (zoals Kleine Boerderij) importeren door de rij-tekst te plakken
- [x] **Zoom & navigatie:** Smooth zoomen op grote charts ✅ Zoom slider in editor. Pan navigatie (drag-to-scroll) nog niet.
- [x] **Raster-markering per 10:** Dikke lijnen per 10 steken ✅ Geïmplementeerd in ChartCanvas

### Prioriteit 4 — Nice to have

- [ ] **Symmetrie-tools:** Automatisch spiegelen (horizontaal/verticaal) tijdens tekenen
- [ ] **Template-patronen:** Startsjablonen voor veelvoorkomende layouts (3x3 grid voor speelkleed)
- [ ] **Export naar Stitchfiddle formaat:** Voor backwards compatibility
- [ ] **Versiebeheer:** Verschillende versies van een patroon bijhouden

### Extra gerealiseerd (niet in oorspronkelijke roadmap)

- [x] **Vercel deployment:** Live op https://yarnzoo-studio.vercel.app
- [x] **Login gate:** Verplichte authenticatie op Vercel, bypass lokaal
- [x] **UI redesign:** Top bar met workflow stepper, context-afhankelijke layouts per stap
- [x] **Stitch statistieken:** Per-kleur telling, dc/sc ratio, percentages in rechter sidebar
- [x] **Chart Size Calculator:** Swatch > gewenste maat > kolommen/rijen berekening
- [x] **Garenpalet beheer:** Vergrendelde basiskleuren + eigen kleuren toevoegen
- [x] **Mappen beheer:** Folder organisatie voor opgeslagen patronen
- [x] **Cloud sync:** Supabase workspace synchronisatie

---

## Planning (voorstel)

| Fase | Wat | Status |
|------|-----|:---:|
| **Studio P1** | Steek-chart + geschreven patroon 100% correct | ✅ Afgerond |
| **Studio P2** | UX verbeteringen (undo, opslaan, editor, UI redesign) | ✅ Afgerond |
| **Deployment** | Vercel + login gate + cloud sync | ✅ Afgerond |
| **1** | Proof of concept PDF (Kleine Boerderij nabouwen) | ⬜ Volgende |
| **2** | PDF-generator gekoppeld aan Mosaic Studio | ⬜ Gepland |
| **3** | Meertalig (NL/EN/DE) | ⬜ Gepland |

---

## Samenvatting

Het einddoel is: je opent de Mosaic Studio, ontwerpt je patroon (of importeert het), vult de metadata in (naam, kleuren, materiaal, intro, foto), kiest een taal, en klikt op **"Genereer PDF"**. Binnen seconden heb je een verkoopklaar patroon in je huisstijl, klaar voor Shopify, Ravelry en Etsy.

Geen InDesign meer. Geen handmatig opmaken. Geen frustratie met tekstlengte per taal.
