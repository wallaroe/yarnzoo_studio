# Overlay Mosaic Logic - Source of Truth

Laatst bijgewerkt: 2026-02-14 06:59 CET  
Project: `yarnzoo_studio`  
Primair bestand: `src/YarnZooMosaicStudio_v3.jsx`

## Doel
Dit document is de vaste referentie voor de steeklogica en rendering in YarnZoo Mosaic Studio.  
Bij nieuwe bugs of refactors moet de code hieraan voldoen.

## 1. Datamodel en indexering
- Het chartmodel is `chart[y][x]` met booleans.
- `true` = symbool (`F`) = stokje.
- `false` = geen symbool = vaste.
- `y = 0` is de bovenste rij in de UI.
- `y = h - 1` is de onderste rij, dit is **Rij 1** (haakstart).
- Rijkleur wisselt per rij:
  - Rij 1 (onderste) = kleur A
  - Rij 2 = kleur B
  - Rij 3 = kleur A
  - etc.

Code referentie:
- `getRowColor`: `src/YarnZooMosaicStudio_v3.jsx:94`

## 2. Steekregels (functioneel)
- Elke rij wordt volledig in 1 actieve kleur gehaakt (A/B afwisselend).
- Elk vakje op de rij is exact 1 steek.
- Zonder symbool: vaste in achterste lus.
- Met symbool `F`: stokje in voorste lus (overlay).
- **Rij 1 is altijd vaste**: daar zijn geen symbolen toegestaan.
- **Geen stokje op stokje in aangrenzende rijen** (verticale buren):
  - `chart[y][x]` en `chart[y-1][x]` mogen niet beide `true` zijn.
- Stokje op dezelfde kleur (2 rijen verschil) is toegestaan.

Code referentie:
- `validateNoStacking`: `src/YarnZooMosaicStudio_v3.jsx:97`

## 3. Overlay-richting (visueel)
- Een symbool op rij `y` kleurt:
  - het eigen vakje `y`
  - het vakje **eronder** `y + 1` (als dat bestaat)
- Dus: `F` “valt” visueel 2 vakjes hoog naar beneden.

Code referentie:
- Editor canvas: `src/YarnZooMosaicStudio_v3.jsx:272`
- Visuele preview: `src/YarnZooMosaicStudio_v3.jsx:558`

## 4. Kleurweergave
- Er zijn maar 2 chartkleuren in de grid: kleur A en kleur B.
- Geen extra tinten voor vaste/stokje.
- Verschil tussen vaste en stokje is alleen het symbool `F`.

Code referentie:
- Grid rendering in `ChartCanvas`: `src/YarnZooMosaicStudio_v3.jsx:272`

## 5. Afbeelding -> chart conversie
- De afbeelding wordt eerst een donker/licht masker via threshold.
- Daarna wordt niet direct “donker = stokje” gedaan.
- Per kolom wordt een optimale symbolenreeks berekend met DP:
  - twee interpretaties worden getest:
    - donker = kleur A
    - donker = kleur B
  - beste (laagste mismatch) wordt gekozen.
  - constraints in DP:
    - geen aangrenzende symbolen
    - onderste rij geen symbool
- Na de DP volgt altijd `validateNoStacking(...)` als finale guard.

Code referentie:
- `imageToChart`: `src/YarnZooMosaicStudio_v3.jsx:129`
- Grid bevestigen: `confirmGrid`: `src/YarnZooMosaicStudio_v3.jsx:1097`

## 6. Editor-gedrag
- Als gebruiker symbool probeert te zetten op Rij 1: blokkeren + melding.
- Als edit een ongeldige verticale stapel veroorzaakt: automatisch corrigeren + melding.
- Omkeren/spiegelen en laden van chart worden ook gevalideerd.

Code referentie:
- `ChartCanvas` paint-flow: `src/YarnZooMosaicStudio_v3.jsx:272`
- Centrale validatiepad in appstate: `src/YarnZooMosaicStudio_v3.jsx` (apply validated updates)

## 7. Regressie-checklist (verplicht na logica-wijziging)
1. Rij 1 (onderste rij) bevat nooit `F`.
2. Geen kolom heeft `F` op twee aangrenzende rijen.
3. Een `F` kleurt in editor het eigen vak + vak eronder.
4. Preview (stap 2) en editor tonen dezelfde overlay-richting.
5. Bij dezelfde upload-afbeelding is patroon stabiel (geen random variatie).
6. Slechts twee zichtbare basiskleuren in het raster.
7. `npm run build` slaagt.

## 8. Als er weer een bug optreedt
- Controleer eerst of de bug één van de regels in sectie 2-4 schendt.
- Controleer daarna of de fout in:
  - conversie (`imageToChart`)
  - validatie (`validateNoStacking`)
  - rendering (`ChartCanvas` / `VisualPreview`)
  zit.
- Elke fix moet:
  - deze file updaten als regelgedrag verandert
  - regressie-checklist opnieuw doorlopen.
