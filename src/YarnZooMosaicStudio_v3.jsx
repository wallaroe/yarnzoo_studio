import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { supabase, hasSupabaseConfig } from "./lib/supabaseClient";
import jsPDF from "jspdf";

// ============================================================
// YARNZOO MOSAIC STUDIO v0.3.1 — Edge Stitches & RtoL Config
// ============================================================

const B = {
  orange: "#E74016",
  orangeLight: "#F26A48",
  orangeHover: "#C63713",
  orangeAlt: "#EF7D00",
  darkGreen: "#444249",
  lightGreen: "#D75A3C",
  cream: "#FFEDEC",
  beige: "#E6E6E6",
  border: "#EBEBED",
  announcementBg: "#FFF1DB",
  announcementText: "#2C2D2E",
  brown: "#444249",
  dark: "#444249",
  white: "#FFFFFF",
};

const F = {
  heading: "'SketchSolid', 'CamptonMedium', 'Campton Medium', sans-serif",
  body: "'CamptonMedium', 'Campton Medium', sans-serif",
  mono: "'CamptonMedium', 'Campton Medium', sans-serif",
};

const BRAND_FONT_FACE_CSS = `
@font-face {
  font-family: SketchSolid;
  src: url("https://cdn.shopify.com/s/files/1/0773/7216/2371/files/KGSecondChancesSolid.woff?v=1693171374") format("woff");
  font-display: swap;
}
@font-face {
  font-family: CamptonMedium;
  src: url("https://cdn.shopify.com/s/files/1/0773/7216/2371/files/campton-medium.woff?v=1693171374") format("woff");
  font-display: swap;
}
`;

const STORAGE_KEY = "yarnzoo_mosaic_workspace_v1";
const DEFAULT_FOLDER_ID = "folder-default";
const DELETED_FOLDER_ID = "folder-deleted";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_FOLDERS = [
  { id: DEFAULT_FOLDER_ID, name: "Mijn charts", system: true },
  { id: DELETED_FOLDER_ID, name: "Verwijderde charts", system: true },
];

const PAPER_SIZES_MM = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  Letter: { w: 216, h: 279 },
};

const COLOR_PALETTE_STORAGE_KEY = "yarnzoo_color_palette_v1";

const DEFAULT_YARN_PALETTE = [
  { name: "Zandvoort", hex: "#E8DCC8", brand: "YarnZoo", line: "Mosaic", code: "A01", locked: true },
  { name: "Arnhem", hex: "#C75050", brand: "YarnZoo", line: "Mosaic", code: "B01", locked: true },
  { name: "Leiden", hex: "#D9A441", brand: "YarnZoo", line: "Mosaic", code: "A02", locked: true },
  { name: "Gouda", hex: "#9C6B3F", brand: "YarnZoo", line: "Mosaic", code: "B02", locked: true },
  { name: "Delft", hex: "#5872A8", brand: "YarnZoo", line: "Mosaic", code: "A03", locked: true },
  { name: "Utrecht", hex: "#324E7B", brand: "YarnZoo", line: "Mosaic", code: "B03", locked: true },
  { name: "Haarlem", hex: "#7FA36B", brand: "YarnZoo", line: "Mosaic", code: "A04", locked: true },
  { name: "Maastricht", hex: "#4A6D53", brand: "YarnZoo", line: "Mosaic", code: "B04", locked: true },
];
const DEFAULT_COLOR_A = { name: DEFAULT_YARN_PALETTE[0].name, hex: DEFAULT_YARN_PALETTE[0].hex };
const DEFAULT_COLOR_B = { name: DEFAULT_YARN_PALETTE[1].name, hex: DEFAULT_YARN_PALETTE[1].hex };

const DEFAULT_PATTERN_TEXTS = {
  nl: {
    label: "Nederlands",
    rowWord: "Rij",
    termSc: "vaste",
    termDc: "stokje",
    edgeATemplate: "kantsteek A ({color})",
    edgeBTemplate: "kantsteek B ({color})",
    rowLineTemplate: "{rowWord} {rowNum}: ({edge}), {stitches}, ({edge})",
    headerTitle: "HAAKPATROON - Overlay Mozaiek",
    dimensionsTemplate: "Afmetingen: {w} steken breed x {h} rijen hoog",
    directionLabel: "Telrichting",
    directionRtoL: "Rechts naar links (←)",
    directionLtoR: "Links naar rechts (→)",
    colorsTitle: "Kleuren:",
    colorAInfoTemplate: "{name} (kleur A): oneven rijen",
    colorBInfoTemplate: "{name} (kleur B): even rijen",
    stitchesTitle: "Steken:",
    scInfo: "vaste = vaste in de achterste lus",
    dcInfo: "stokje = stokje in de voorste lus, 2 rijen lager",
    edgeInfo: "kantsteek A/B = begin- en eindsteek van de rij",
    startLine1Template: "Start: maak met {name} een lossenketting van {chainCount} lossen,",
    startLine2Template: "start in de 2e losse vanaf de haaknaald met in elke losse een vaste [{stitchCount}]. Hecht af.",
    writtenTitle: "GESCHREVEN TEKST",
    colorsLabelInline: "Kleuren",
    directionLabelInline: "Richting",
    startLabelInline: "Start",
    startInlineTemplate: "Start met {name}, lossenketting van {chainCount} lossen, start in de 2e losse met in elke losse een vaste [{stitchCount}]. Hecht af.",
    fileName: "haakpatroon_nl",
  },
  en: {
    label: "English",
    rowWord: "Row",
    termSc: "single crochet",
    termDc: "double crochet",
    edgeATemplate: "edge stitch A ({color})",
    edgeBTemplate: "edge stitch B ({color})",
    rowLineTemplate: "{rowWord} {rowNum}: ({edge}), {stitches}, ({edge})",
    headerTitle: "CROCHET PATTERN - Overlay Mosaic",
    dimensionsTemplate: "Size: {w} stitches wide x {h} rows high",
    directionLabel: "Reading direction",
    directionRtoL: "Right to left (←)",
    directionLtoR: "Left to right (→)",
    colorsTitle: "Colors:",
    colorAInfoTemplate: "{name} (color A): odd rows",
    colorBInfoTemplate: "{name} (color B): even rows",
    stitchesTitle: "Stitches:",
    scInfo: "single crochet = worked in back loop",
    dcInfo: "double crochet = worked in front loop, 2 rows below",
    edgeInfo: "edge stitch A/B = first and last stitch of the row",
    startLine1Template: "Start: with {name}, make a foundation chain of {chainCount} chains,",
    startLine2Template: "start in the 2nd chain from hook and work single crochet across [{stitchCount}]. Fasten off.",
    writtenTitle: "WRITTEN PATTERN",
    colorsLabelInline: "Colors",
    directionLabelInline: "Direction",
    startLabelInline: "Start",
    startInlineTemplate: "Start with {name}, chain {chainCount}, begin in the 2nd chain and work single crochet in each chain [{stitchCount}]. Fasten off.",
    fileName: "crochet_pattern_en",
  },
  de: {
    label: "Deutsch",
    rowWord: "Reihe",
    termSc: "feste Masche",
    termDc: "Staebchen",
    edgeATemplate: "Randmasche A ({color})",
    edgeBTemplate: "Randmasche B ({color})",
    rowLineTemplate: "{rowWord} {rowNum}: ({edge}), {stitches}, ({edge})",
    headerTitle: "HAEKELMUSTER - Overlay Mosaik",
    dimensionsTemplate: "Groesse: {w} Maschen breit x {h} Reihen hoch",
    directionLabel: "Leserichtung",
    directionRtoL: "Rechts nach links (←)",
    directionLtoR: "Links nach rechts (→)",
    colorsTitle: "Farben:",
    colorAInfoTemplate: "{name} (Farbe A): ungerade Reihen",
    colorBInfoTemplate: "{name} (Farbe B): gerade Reihen",
    stitchesTitle: "Maschen:",
    scInfo: "feste Masche = in das hintere Maschenglied",
    dcInfo: "Staebchen = in das vordere Maschenglied, 2 Reihen tiefer",
    edgeInfo: "Randmasche A/B = erste und letzte Masche der Reihe",
    startLine1Template: "Start: mit {name} eine Luftmaschenkette von {chainCount} Luftmaschen,",
    startLine2Template: "in die 2. Luftmasche ab Nadel einstechen und feste Maschen ueber die Reihe [{stitchCount}]. Faden abschneiden.",
    writtenTitle: "AUSGESCHRIEBENES MUSTER",
    colorsLabelInline: "Farben",
    directionLabelInline: "Richtung",
    startLabelInline: "Start",
    startInlineTemplate: "Start mit {name}, Luftmaschenkette mit {chainCount} Luftmaschen, ab der 2. Luftmasche feste Maschen [{stitchCount}]. Faden abschneiden.",
    fileName: "haekelmuster_de",
  },
};

const TRANSLATION_STORAGE_KEY = "yarnzoo_pattern_translations_v1";
const GLOBAL_TRANSLATIONS_TABLE = "app_translations";
const GLOBAL_TRANSLATIONS_ID = "pattern_texts";

const TRANSLATION_FIELDS = [
  { key: "label", term: "Taalnaam" },
  { key: "rowWord", term: "Rij / Row" },
  { key: "termSc", term: "Vaste" },
  { key: "termDc", term: "Stokje" },
  { key: "edgeATemplate", term: "Kantsteek A" },
  { key: "edgeBTemplate", term: "Kantsteek B" },
  { key: "rowLineTemplate", term: "Regel template" },
  { key: "directionRtoL", term: "Richting R->L" },
  { key: "directionLtoR", term: "Richting L->R" },
  { key: "colorAInfoTemplate", term: "Kleur A uitleg" },
  { key: "colorBInfoTemplate", term: "Kleur B uitleg" },
  { key: "writtenTitle", term: "Sectietitel" },
];

function loadWorkspace() {
  if (typeof window === "undefined") {
    return { folders: DEFAULT_FOLDERS, charts: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { folders: DEFAULT_FOLDERS, charts: [] };
    const parsed = JSON.parse(raw);
    const folders = Array.isArray(parsed?.folders) ? parsed.folders : [];
    const charts = Array.isArray(parsed?.charts) ? parsed.charts : [];
    const folderIds = new Set(folders.map(f => f.id));
    const mergedFolders = [...folders];
    for (const f of DEFAULT_FOLDERS) {
      if (!folderIds.has(f.id)) mergedFolders.push(f);
    }
    return { folders: mergedFolders, charts };
  } catch {
    return { folders: DEFAULT_FOLDERS, charts: [] };
  }
}

function saveWorkspace(folders, charts) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ folders, charts }));
}

function normalizeHexColor(value) {
  const raw = String(value || "").trim();
  if (/^#[0-9A-Fa-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();
  return null;
}

function normalizePaletteEntry(entry, fallbackIndex = 0) {
  if (!entry || typeof entry !== "object") return null;
  const hex = normalizeHexColor(entry.hex);
  if (!hex) return null;
  const name = String(entry.name || "").trim() || `Kleur ${fallbackIndex + 1}`;
  return {
    name,
    hex,
    brand: String(entry.brand || "").trim(),
    line: String(entry.line || "").trim(),
    code: String(entry.code || "").trim(),
    locked: !!entry.locked,
  };
}

function loadColorPalette() {
  const defaults = DEFAULT_YARN_PALETTE
    .map((entry, idx) => normalizePaletteEntry({ ...entry, locked: true }, idx))
    .filter(Boolean);
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(COLOR_PALETTE_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    const normalizedStored = list
      .map((entry, idx) => normalizePaletteEntry({ ...entry, locked: false }, idx))
      .filter(Boolean);
    const lockedNames = new Set(defaults.map(entry => entry.name.toLowerCase()));
    const lockedHexes = new Set(defaults.map(entry => entry.hex.toUpperCase()));
    const customByName = new Map();

    for (const entry of normalizedStored) {
      const nameKey = entry.name.toLowerCase();
      const hexKey = entry.hex.toUpperCase();
      if (lockedNames.has(nameKey) || lockedHexes.has(hexKey)) continue;
      customByName.set(nameKey, { ...entry, locked: false });
    }

    return [...defaults, ...Array.from(customByName.values())];
  } catch {
    return defaults;
  }
}

function saveColorPalette(palette) {
  if (typeof window === "undefined") return;
  try {
    const persist = (Array.isArray(palette) ? palette : [])
      .filter(entry => !entry?.locked)
      .map(({ name, hex, brand, line, code }) => ({ name, hex, brand, line, code, locked: false }));
    localStorage.setItem(COLOR_PALETTE_STORAGE_KEY, JSON.stringify(persist));
  } catch {
    // ignore storage errors
  }
}

function normalizeActiveColor(color, fallback) {
  if (!color || typeof color !== "object") return { ...fallback };
  return {
    name: String(color.name || "").trim() || fallback.name,
    hex: normalizeHexColor(color.hex) || fallback.hex,
  };
}

function upsertPaletteWithColor(prevPalette, color) {
  const normalized = normalizePaletteEntry(color, prevPalette.length);
  if (!normalized) return prevPalette;

  const next = [...prevPalette];
  const sameNameIdx = next.findIndex(entry => entry.name.trim().toLowerCase() === normalized.name.trim().toLowerCase());
  const sameHexIdx = next.findIndex(entry => entry.hex.toUpperCase() === normalized.hex.toUpperCase());
  const targetIdx = sameNameIdx >= 0 ? sameNameIdx : sameHexIdx;

  if (targetIdx >= 0) {
    if (next[targetIdx].locked) return prevPalette;
    next[targetIdx] = { ...next[targetIdx], ...normalized, locked: false };
  } else {
    next.push({ ...normalized, locked: false });
  }

  return next;
}

function withinRestoreWindow(chart) {
  return !!(chart?.isDeleted && chart?.deletedAt && (Date.now() - new Date(chart.deletedAt).getTime() <= ONE_WEEK_MS));
}

function templateText(template, vars = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_m, key) => (vars[key] ?? ""));
}

function normalizePatternTexts(raw) {
  const baseNl = DEFAULT_PATTERN_TEXTS.nl;
  const normalized = {};

  for (const [lang, preset] of Object.entries(DEFAULT_PATTERN_TEXTS)) {
    normalized[lang] = { ...baseNl, ...preset, label: preset.label || lang };
  }

  if (!raw || typeof raw !== "object") return normalized;

  for (const [lang, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const cleanLang = String(lang).trim().toLowerCase();
    if (!cleanLang) continue;
    normalized[cleanLang] = {
      ...baseNl,
      ...(normalized[cleanLang] || {}),
      ...value,
      label: value.label || normalized[cleanLang]?.label || cleanLang.toUpperCase(),
    };
  }

  return normalized;
}

function loadTranslationConfig() {
  if (typeof window === "undefined") return { texts: normalizePatternTexts(null), locked: true };
  try {
    const raw = localStorage.getItem(TRANSLATION_STORAGE_KEY);
    if (!raw) return { texts: normalizePatternTexts(null), locked: true };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.texts) {
      return {
        texts: normalizePatternTexts(parsed.texts),
        locked: typeof parsed.locked === "boolean" ? parsed.locked : true,
      };
    }
    // Backward compatibility with older format storing only texts
    return { texts: normalizePatternTexts(parsed), locked: true };
  } catch {
    return { texts: normalizePatternTexts(null), locked: true };
  }
}

function saveTranslationConfig(texts, locked) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TRANSLATION_STORAGE_KEY, JSON.stringify({ texts, locked }));
  } catch {
    // ignore quota/storage errors
  }
}

function resolvePaperSizeMm(paper, orientation) {
  const base = PAPER_SIZES_MM[paper] || PAPER_SIZES_MM.A4;
  if (orientation === "landscape") {
    return { w: base.h, h: base.w };
  }
  return base;
}

function computePrintLayout({ chartWidth, chartHeight, showEdges, paper, orientation, marginMm, mode, cellMm }) {
  const totalCols = chartWidth + (showEdges ? 2 : 0);
  const paperSize = resolvePaperSizeMm(paper, orientation);
  const safeMargin = Math.max(3, Number(marginMm) || 0);
  const printableWmm = Math.max(40, paperSize.w - safeMargin * 2);
  const printableHmm = Math.max(40, paperSize.h - safeMargin * 2);

  if (mode === "single") {
    const effectiveCellMm = Math.max(0.8, Math.min(printableWmm / totalCols, printableHmm / chartHeight));
    return {
      totalCols,
      rowsPerPage: chartHeight,
      colsPerPage: totalCols,
      pagesX: 1,
      pagesY: 1,
      totalPages: 1,
      cellMm: effectiveCellMm,
      printableWmm,
      printableHmm,
      marginMm: safeMargin,
    };
  }

  const effectiveCellMm = Math.max(1.2, Number(cellMm) || 3.2);
  const colsPerPage = Math.max(1, Math.floor(printableWmm / effectiveCellMm));
  const rowsPerPage = Math.max(1, Math.floor(printableHmm / effectiveCellMm));
  const pagesX = Math.max(1, Math.ceil(totalCols / colsPerPage));
  const pagesY = Math.max(1, Math.ceil(chartHeight / rowsPerPage));

  return {
    totalCols,
    rowsPerPage,
    colsPerPage,
    pagesX,
    pagesY,
    totalPages: pagesX * pagesY,
    cellMm: effectiveCellMm,
    printableWmm,
    printableHmm,
    marginMm: safeMargin,
  };
}

// Vector-based chart drawing directly into PDF (sharp at any zoom level)
function drawChartVectorInPDF({
  doc,
  chart,
  colA,
  colB,
  config,
  startX,
  startY,
  availableWidth,
  availableHeight,
  startRow = 0,
  endRow = null,
  showAllColumnNumbers = true, // false = only show every 10th column number
}) {
  const w = chart[0].length;
  const h = chart.length;
  const actualEndRow = endRow !== null ? endRow : h;
  const visibleRows = actualEndRow - startRow;
  const xOffset = config.showEdges ? 1 : 0;
  const totalCols = w + (config.showEdges ? 2 : 0);

  // Calculate cell size to fit in available space with proper margins for labels
  const rowLabelWidth = 10; // mm for row numbers on each side
  const colLabelHeight = 5; // mm for column numbers top/bottom (small horizontal text)
  const chartAreaW = availableWidth - rowLabelWidth * 2;
  const chartAreaH = availableHeight - colLabelHeight * 2;
  const cellMm = Math.min(chartAreaW / totalCols, chartAreaH / visibleRows);

  // Actual chart dimensions
  const chartW = totalCols * cellMm;
  const chartH = visibleRows * cellMm;

  // Center the chart
  const offsetX = startX + rowLabelWidth + (chartAreaW - chartW) / 2;
  const offsetY = startY + colLabelHeight + (chartAreaH - chartH) / 2;

  // Parse colors
  const hexToRgb = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];

  const getRowColor = (rowIdx) => (rowIdx % 2 === 0 ? 0 : 1);
  const getRowHex = (globalY) => {
    const rowNum = h - globalY;
    return getRowColor(rowNum - 1) === 0 ? colA.hex : colB.hex;
  };

  // Draw cells
  for (let gy = startRow; gy < actualEndRow; gy++) {
    for (let gx = 0; gx < totalCols; gx++) {
      const cellX = offsetX + gx * cellMm;
      const cellY = offsetY + (gy - startRow) * cellMm;

      // Determine cell color
      let cellHex = getRowHex(gy);
      if (!config.showEdges || (gx !== 0 && gx !== totalCols - 1)) {
        if (gx >= xOffset && gx < xOffset + w && gy > 0) {
          const patternX = gx - xOffset;
          if (chart[gy - 1] && chart[gy - 1][patternX]) {
            cellHex = getRowHex(gy - 1);
          }
        }
      }
      const rgb = hexToRgb(cellHex);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(cellX, cellY, cellMm, cellMm, "F");

      // Draw edge stitch indicator (small white dot)
      if (config.showEdges && (gx === 0 || gx === totalCols - 1)) {
        doc.setFillColor(255, 255, 255);
        doc.circle(cellX + cellMm / 2, cellY + cellMm / 2, cellMm * 0.12, "F");
      }
    }
  }

  // Draw F symbols - scale font with cell size (no minimum threshold)
  // Font should be ~55% of cell height, convert mm to points (1mm ≈ 2.83pt)
  const symbolFontSize = Math.max(1.2, cellMm * 0.55 * 2.83);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(symbolFontSize);
  doc.setFont("helvetica", "bold");
  for (let gy = startRow; gy < actualEndRow; gy++) {
    for (let gx = 0; gx < totalCols; gx++) {
      if (config.showEdges && (gx === 0 || gx === totalCols - 1)) continue;
      const patternX = gx - xOffset;
      if (patternX < 0 || patternX >= w) continue;
      if (!chart[gy] || !chart[gy][patternX]) continue;
      const cellX = offsetX + gx * cellMm + cellMm / 2;
      const cellY = offsetY + (gy - startRow) * cellMm + cellMm * 0.65;
      doc.text("F", cellX, cellY, { align: "center" });
    }
  }

  // Draw thin grid lines
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.05);
  // Vertical lines
  for (let x = 0; x <= totalCols; x++) {
    const px = offsetX + x * cellMm;
    doc.line(px, offsetY, px, offsetY + chartH);
  }
  // Horizontal lines
  for (let y = 0; y <= visibleRows; y++) {
    const py = offsetY + y * cellMm;
    doc.line(offsetX, py, offsetX + chartW, py);
  }

  // Thicker lines every 10 rows/cols
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.15);
  for (let x = 0; x <= totalCols; x++) {
    const colNum = config.direction === "RtoL" ? totalCols - x : x + 1;
    if (colNum % 10 === 0 || x === 0 || x === totalCols) {
      const px = offsetX + x * cellMm;
      doc.line(px, offsetY, px, offsetY + chartH);
    }
  }
  for (let y = 0; y <= visibleRows; y++) {
    const rowNum = h - (startRow + y);
    if (rowNum % 10 === 0 || y === 0 || y === visibleRows) {
      const py = offsetY + y * cellMm;
      doc.line(offsetX, py, offsetX + chartW, py);
    }
  }

  // Draw row numbers (left and right) - EVERY row gets a number
  doc.setTextColor(68, 68, 68);
  const rowFontSize = Math.max(1.5, Math.min(3, cellMm * 0.8));
  doc.setFontSize(rowFontSize);
  doc.setFont("helvetica", "bold");
  for (let gy = startRow; gy < actualEndRow; gy++) {
    const rowNum = h - gy;
    const cellY = offsetY + (gy - startRow) * cellMm + cellMm / 2 + rowFontSize * 0.12;
    // Left
    doc.text(`${rowNum}`, offsetX - 0.5, cellY, { align: "right" });
    // Right
    doc.text(`${rowNum}`, offsetX + chartW + 0.5, cellY, { align: "left" });
  }

  // Draw column numbers (top and bottom) - HORIZONTAL, scaled to fit cell width
  // Font size: 3-digit number must fit in cell width (divide by 3 for char width)
  if (showAllColumnNumbers) {
    const colFontSizePt = Math.max(0.5, (cellMm / 3) * 2.83);
    doc.setFontSize(colFontSizePt);
    for (let gx = 0; gx < totalCols; gx++) {
      const colNum = config.direction === "RtoL" ? totalCols - gx : gx + 1;
      const cellX = offsetX + gx * cellMm + cellMm / 2;
      // Top - centered above column
      doc.text(`${colNum}`, cellX, offsetY - 0.5, { align: "center" });
      // Bottom - centered below column
      doc.text(`${colNum}`, cellX, offsetY + chartH + 0.5, { align: "center" });
    }
  }

  return { chartW, chartH, cellMm, offsetX, offsetY };
}

function buildPrintPageImage({
  chart,
  colA,
  colB,
  config,
  layout,
  pageX,
  pageY,
  dpi = 180,
  showSymbols = true,
}) {
  const w = chart[0].length;
  const h = chart.length;
  const xOffset = config.showEdges ? 1 : 0;

  const startCol = pageX * layout.colsPerPage;
  const endCol = Math.min(layout.totalCols, startCol + layout.colsPerPage);
  const startRow = pageY * layout.rowsPerPage;
  const endRow = Math.min(h, startRow + layout.rowsPerPage);

  const visibleCols = endCol - startCol;
  const visibleRows = endRow - startRow;
  const pxPerMm = dpi / 25.4;
  const cellPx = Math.max(4, layout.cellMm * pxPerMm);

  const rowDigits = String(h).length;
  // Scale font with cell size - no minimum, so labels fit even on small cells
  const rowFontPx = Math.max(2, Math.min(48, cellPx * 0.85));
  const colFontPx = Math.max(2, cellPx / 3); // 3 digits must fit in cell width
  const marginLeft = Math.ceil(24 + rowDigits * (rowFontPx * 0.8));
  const marginRight = marginLeft;
  const marginTop = Math.ceil(16 + colFontPx * 2);
  const marginBottom = Math.ceil(16 + colFontPx * 2);

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(visibleCols * cellPx + marginLeft + marginRight);
  canvas.height = Math.ceil(visibleRows * cellPx + marginTop + marginBottom);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(marginLeft, marginTop);

  const cellBounds = (gx, gy) => ({
    x: (gx - startCol) * cellPx,
    y: (gy - startRow) * cellPx,
  });

  const getRowHex = (globalY) => {
    const rowNum = h - globalY;
    const colorIdx = getRowColor(rowNum - 1);
    return colorIdx === 0 ? colA.hex : colB.hex;
  };

  const getFinalCellColor = (globalX, globalY) => {
    const rowHex = getRowHex(globalY);
    if (!config.showEdges || (globalX !== 0 && globalX !== layout.totalCols - 1)) {
      if (globalX >= xOffset && globalX < xOffset + w && globalY > 0) {
        const patternX = globalX - xOffset;
        if (chart[globalY - 1][patternX]) {
          return getRowHex(globalY - 1);
        }
      }
    }
    return rowHex;
  };

  for (let gy = startRow; gy < endRow; gy++) {
    for (let gx = startCol; gx < endCol; gx++) {
      const { x, y } = cellBounds(gx, gy);
      ctx.fillStyle = getFinalCellColor(gx, gy);
      ctx.fillRect(x, y, cellPx, cellPx);
    }
  }

  for (let gy = startRow; gy < endRow; gy++) {
    for (let gx = startCol; gx < endCol; gx++) {
      if (config.showEdges && (gx === 0 || gx === layout.totalCols - 1)) {
        const { x, y } = cellBounds(gx, gy);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x + cellPx / 2, y + cellPx / 2, Math.max(1.5, cellPx * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Draw F symbols - scale font with cell size (55% of cell, min 2px)
  const symbolFontPx = Math.max(2, cellPx * 0.55);
  // Only draw if font would be readable (at least 2px)
  if (symbolFontPx >= 2) {
    ctx.fillStyle = "#1a1a1a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${symbolFontPx}px monospace`;
    for (let gy = startRow; gy < endRow; gy++) {
      for (let gx = startCol; gx < endCol; gx++) {
        if (config.showEdges && (gx === 0 || gx === layout.totalCols - 1)) continue;
        const patternX = gx - xOffset;
        if (patternX < 0 || patternX >= w) continue;
        if (!chart[gy] || !chart[gy][patternX]) continue;
        const { x, y } = cellBounds(gx, gy);
        ctx.fillText("F", x + cellPx / 2, y + cellPx / 2);
      }
    }
  }

  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = Math.max(0.6, cellPx * 0.03);
  for (let x = 0; x <= visibleCols; x++) {
    const px = x * cellPx;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, visibleRows * cellPx);
    ctx.stroke();
  }
  for (let y = 0; y <= visibleRows; y++) {
    const py = y * cellPx;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(visibleCols * cellPx, py);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, cellPx * 0.06);
  if (config.direction === "RtoL") {
    for (let i = 0; i <= w; i += 10) {
      const globalX = xOffset + (w - i);
      if (globalX < startCol || globalX > endCol) continue;
      const px = (globalX - startCol) * cellPx;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, visibleRows * cellPx);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i <= w; i += 10) {
      const globalX = xOffset + i;
      if (globalX < startCol || globalX > endCol) continue;
      const px = (globalX - startCol) * cellPx;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, visibleRows * cellPx);
      ctx.stroke();
    }
  }
  for (let i = 0; i <= h; i += 10) {
    const globalY = h - i;
    if (globalY < startRow || globalY > endRow) continue;
    const py = (globalY - startRow) * cellPx;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(visibleCols * cellPx, py);
    ctx.stroke();
  }

  if (config.showEdges) {
    const leftSep = xOffset;
    const rightSep = layout.totalCols - 1;
    if (leftSep >= startCol && leftSep <= endCol) {
      const px = (leftSep - startCol) * cellPx;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, visibleRows * cellPx);
      ctx.stroke();
    }
    if (rightSep >= startCol && rightSep <= endCol) {
      const px = (rightSep - startCol) * cellPx;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, visibleRows * cellPx);
      ctx.stroke();
    }
  }

  ctx.fillStyle = "#444";
  ctx.font = `bold ${rowFontPx}px monospace`;
  ctx.textBaseline = "middle";
  const rowLabelOffset = Math.max(10, rowFontPx * 0.5);
  for (let gy = startRow; gy < endRow; gy++) {
    const rowNum = h - gy;
    const y = (gy - startRow) * cellPx + cellPx / 2;
    ctx.textAlign = "right";
    ctx.fillText(`${rowNum}`, -rowLabelOffset, y);
    ctx.textAlign = "left";
    ctx.fillText(`${rowNum}`, visibleCols * cellPx + rowLabelOffset, y);
  }

  // Column numbers - horizontal, scaled to fit 3-digit numbers in cell width
  ctx.fillStyle = "#444";
  const colNumFontPx = Math.max(2, cellPx / 3); // 3 digits must fit in cell width
  ctx.font = `bold ${colNumFontPx}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const colLabelOffset = Math.max(4, colNumFontPx * 0.6);
  for (let gx = startCol; gx < endCol; gx++) {
    const colNum = config.direction === "RtoL" ? layout.totalCols - gx : gx + 1;
    const x = (gx - startCol) * cellPx + cellPx / 2;
    // Top labels
    ctx.fillText(`${colNum}`, x, -colLabelOffset);
    // Bottom labels
    ctx.fillText(`${colNum}`, x, visibleRows * cellPx + colLabelOffset);
  }

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: canvas.width / pxPerMm,
    heightMm: canvas.height / pxPerMm,
    startCol,
    endCol,
    startRow,
    endRow,
  };
}

/*
  OVERLAY MOSAIC CROCHET LOGIC:
  - Rows alternate color: row 1 = color A, row 2 = color B...
  - Validate no stacking: A symbol cannot be directly above another symbol.
*/

const createEmptyChart = (w, h) =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => false));

// Get row color: row 0 (bottom) = A, row 1 = B...
const getRowColor = (rowIdx) => (rowIdx % 2 === 0 ? 0 : 1); // 0=A, 1=B

// Validate no-stacking rule — multiple passes to handle cascades
function validateNoStacking(chart) {
  const h = chart.length, w = chart[0].length;
  const fixed = chart.map(r => [...r]);
  let totalFixes = 0;

  // Bottom row (row 1) is always "v".
  for (let x = 0; x < w; x++) {
    if (fixed[h - 1][x]) {
      fixed[h - 1][x] = false;
      totalFixes++;
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let y = h - 1; y > 0; y--) {
      for (let x = 0; x < w; x++) {
        if (fixed[y][x] && fixed[y - 1][x]) {
          fixed[y - 1][x] = false;
          totalFixes++;
          changed = true;
        }
      }
    }
  }
  return { chart: fixed, fixes: totalFixes };
}

// ============================================================
// Image to Chart Conversion
// ============================================================
function imageToChart(img, targetW, targetH, threshold) {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, targetW, targetH);
  const data = ctx.getImageData(0, 0, targetW, targetH).data;

  // 1) Build dark/light mask from source image.
  const darkMask = [];
  for (let y = 0; y < targetH; y++) {
    const row = [];
    for (let x = 0; x < targetW; x++) {
      const i = (y * targetW + x) * 4;
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      row.push(gray < threshold);
    }
    darkMask.push(row);
  }

  // 2) Solve overlay symbols from desired final color map.
  // Mapping tries both interpretations:
  // - dark pixel => color A
  // - dark pixel => color B
  // and picks the best fit under overlay constraints.
  const baseRowColor = Array.from({ length: targetH }, (_, y) => getRowColor(targetH - y - 1)); // top->bottom

  const solveWithDarkColor = (darkColorIdx) => {
    const chart = Array.from({ length: targetH }, () => Array.from({ length: targetW }, () => false));
    let totalMismatches = 0;

    for (let x = 0; x < targetW; x++) {
      const desired = [];
      for (let y = 0; y < targetH; y++) {
        desired.push(darkMask[y][x] ? darkColorIdx : 1 - darkColorIdx);
      }

      // Symbol on row y overlays row y+1 (the cell below).
      // So for final row y>0, opposite color is controlled by symbol[y-1].
      const needOpposite = desired.map((d, y) => d !== baseRowColor[y]);
      const symbolCount = targetH - 1; // symbol rows 0..h-2, bottom row forbidden

      // DP over symbol[] with "no adjacent true" constraint.
      const INF = 1e9;
      const dp = Array.from({ length: symbolCount + 1 }, () => [INF, INF]);
      const prevPick = Array.from({ length: symbolCount + 1 }, () => [null, null]);
      dp[0][0] = 0;

      for (let y = 0; y < symbolCount; y++) {
        const targetSymbol = needOpposite[y + 1] ? 1 : 0;
        for (let prev = 0; prev <= 1; prev++) {
          if (dp[y][prev] >= INF) continue;
          for (let cur = 0; cur <= 1; cur++) {
            if (y > 0 && prev === 1 && cur === 1) continue;

            const mismatch = cur === targetSymbol ? 0 : 1;
            const score = dp[y][prev] + mismatch;
            if (score < dp[y + 1][cur]) {
              dp[y + 1][cur] = score;
              prevPick[y + 1][cur] = prev;
            }
          }
        }
      }

      let endState = dp[symbolCount][0] <= dp[symbolCount][1] ? 0 : 1;
      const rowZeroMismatch = needOpposite[0] ? 1 : 0;
      totalMismatches += Math.min(dp[symbolCount][0], dp[symbolCount][1]) + rowZeroMismatch;

      const symbols = Array.from({ length: symbolCount }, () => false);
      for (let y = symbolCount; y > 0; y--) {
        symbols[y - 1] = endState === 1;
        endState = prevPick[y][endState] ?? 0;
      }

      for (let y = 0; y < symbolCount; y++) {
        chart[y][x] = symbols[y];
      }
      chart[targetH - 1][x] = false; // bottom row (row 1) always vaste
    }

    return { chart, mismatches: totalMismatches };
  };

  const asDarkA = solveWithDarkColor(0);
  const asDarkB = solveWithDarkColor(1);
  const best = asDarkA.mismatches <= asDarkB.mismatches ? asDarkA : asDarkB;
  return validateNoStacking(best.chart);
}

// ============================================================
// Pattern Generation
// ============================================================
function generateWrittenPattern(chart, colA, colB, direction = "RtoL", textSet = DEFAULT_PATTERN_TEXTS.nl, startRow = 0, endRow = null) {
  const h = chart.length, w = chart[0].length;
  const effectiveEnd = endRow ?? h;
  const rows = [];
  const t = textSet || DEFAULT_PATTERN_TEXTS.nl;

  for (let rowNum = startRow + 1; rowNum <= effectiveEnd; rowNum++) {
    // Row 1 is bottom of chart = chart[h-1]
    const chartY = h - rowNum;
    const colorIdx = getRowColor(rowNum - 1);
    const edgeLabel = colorIdx === 0
      ? templateText(t.edgeATemplate, { color: colA.name })
      : templateText(t.edgeBTemplate, { color: colB.name });

    // Build stitch groups based on direction
    const indices = [];
    if (direction === "RtoL") {
      // Start processing from Right (Index W-1) to Left (0)
      for (let x = w - 1; x >= 0; x--) indices.push(x);
    } else {
      // Start processing from Left (0) to Right (W-1)
      for (let x = 0; x < w; x++) indices.push(x);
    }

    const stitches = [];
    let curType = null, count = 0;

    for (let x of indices) {
      const hasSymbol = chart[chartY][x];
      const stType = hasSymbol ? t.termDc : t.termSc;

      if (stType === curType) {
        count++;
      } else {
        if (curType !== null) stitches.push({ t: curType, c: count });
        curType = stType;
        count = 1;
      }
    }
    if (curType !== null) stitches.push({ t: curType, c: count });

    const stitchStr = stitches
      .map(s => s.c === 1 ? `(${s.t})` : `(${s.t}) x ${s.c}`)
      .join(", ");

    rows.push(templateText(t.rowLineTemplate, {
      rowWord: t.rowWord,
      rowNum,
      edge: edgeLabel,
      stitches: stitchStr,
    }));
  }

  return rows;
}

// ============================================================
// Chart Canvas — shows colored grid with symbols
// ============================================================
function ChartCanvas({ chart, setChart, cellSize, colA, colB, tool, mode, config = { direction: "RtoL", showEdges: true }, onRuleMessage, onDrawStart }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const lastCell = useRef(null);
  const w = chart[0]?.length || 0, h = chart.length;

  // Visual Setup
  const edgeCols = config.showEdges ? 2 : 0;
  const totalW = w + edgeCols;
  // If edges shown, pattern starts at x=1. If not, x=0.
  const xOffset = config.showEdges ? 1 : 0;
  const rowLabelFontSize = Math.max(3, Math.min(12, cellSize * 0.82));
  const maxColFontFromCell = (cellSize - 1) / (Math.max(1, String(totalW).length) * 0.62);
  const colLabelFontSize = Math.max(3, Math.min(11, maxColFontFromCell));
  const rowDigits = String(h).length;
  const colDigits = String(totalW).length;
  const estimatedColLabelWidth = Math.ceil(colDigits * (colLabelFontSize * 0.62));
  const useStaggeredColumnLabels = estimatedColLabelWidth > cellSize - 2;
  const sideMargin = Math.max(42, Math.ceil(16 + rowLabelFontSize + rowDigits * (rowLabelFontSize * 0.65)));
  const marginLeft = sideMargin;
  const marginRight = sideMargin;
  const marginTop = Math.max(24, Math.ceil(12 + colLabelFontSize * (useStaggeredColumnLabels ? 2.4 : 1.5)));
  const marginBottom = Math.max(44, Math.ceil(16 + colLabelFontSize * (useStaggeredColumnLabels ? 2.6 : 1.5)));

  const draw = useCallback(() => {
    const c = ref.current;
    if (!c || !w || !h) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const canvasW = totalW * cellSize + marginLeft + marginRight;
    const canvasH = h * cellSize + marginTop + marginBottom;
    c.width = canvasW * dpr;
    c.height = canvasH * dpr;
    c.style.width = `${canvasW}px`;
    c.style.height = `${canvasH}px`;
    ctx.scale(dpr, dpr);
    ctx.translate(marginLeft, marginTop);

    // Helper: draw a single cell
    function drawCell(vx, vy, size, color, content, symbolColor) {
      ctx.fillStyle = color;
      ctx.fillRect(vx * size, vy * size, size, size);
      if (!content) return;

      ctx.strokeStyle = symbolColor;
      ctx.lineWidth = Math.max(1, size * 0.14);
      const cx = vx * size + size / 2;
      const cy = vy * size + size / 2;

      if (content === "DC") {
        ctx.fillStyle = symbolColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${Math.max(4, size * 0.62)}px monospace`;
        ctx.fillText("F", cx, cy + size * 0.02);
      } else if (content === "KS") {
        ctx.fillStyle = symbolColor;
        ctx.beginPath(); ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    const colAHex = colA.hex;
    const colBHex = colB.hex;

    // --- Draw Grid & Stitches ---
    // 1) Base: every cell is a "v" in the row color (light tint)
    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowColor = colorIdx === 0 ? colAHex : colBHex;

      if (config.showEdges) {
        drawCell(0, y, cellSize, rowColor, "KS", "#fff");
        drawCell(totalW - 1, y, cellSize, rowColor, "KS", "#fff");
      }

      for (let x = 0; x < w; x++) {
        const visualX = xOffset + x;
        drawCell(visualX, y, cellSize, rowColor, null, "#262626");
      }
    }

    // 2) Overlay: a symbol indicates a mosaic dc that is visually two cells high.
    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowColor = colorIdx === 0 ? colAHex : colBHex;
      for (let x = 0; x < w; x++) {
        if (!chart[y][x]) continue;
        const visualX = xOffset + x;
        // current cell
        ctx.fillStyle = rowColor;
        ctx.fillRect(visualX * cellSize, y * cellSize, cellSize, cellSize);
        // covered cell below
        if (y < h - 1) {
          ctx.fillRect(visualX * cellSize, (y + 1) * cellSize, cellSize, cellSize);
        }
      }
    }

    // 3) Symbol mark
    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowColor = colorIdx === 0 ? colAHex : colBHex;
      for (let x = 0; x < w; x++) {
        if (!chart[y][x]) continue;
        const visualX = xOffset + x;
        drawCell(visualX, y, cellSize, rowColor, "DC", "#1f1f1f");
      }
    }

    // --- Grid Lines ---
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= totalW; x++) {
      ctx.beginPath(); ctx.moveTo(x * cellSize, 0); ctx.lineTo(x * cellSize, h * cellSize); ctx.stroke();
    }
    for (let y = 0; y <= h; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cellSize); ctx.lineTo(totalW * cellSize, y * cellSize); ctx.stroke();
    }

    // Bold lines for pattern interval 10
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;

    // Draw bold lines every 10 stitches relative to PATTERN
    if (config.direction === "RtoL") {
      // Count 10 from RIGHT edge of pattern (w + xOffset)
      for (let i = 0; i <= w; i += 10) {
        const relativeX = w - i; // 0, 10, 20 from right
        const visualX = xOffset + relativeX;
        ctx.beginPath(); ctx.moveTo(visualX * cellSize, 0); ctx.lineTo(visualX * cellSize, h * cellSize); ctx.stroke();
      }
    } else {
      // Count 10 from LEFT edge of pattern (xOffset)
      for (let i = 0; i <= w; i += 10) {
        const visualX = xOffset + i;
        ctx.beginPath(); ctx.moveTo(visualX * cellSize, 0); ctx.lineTo(visualX * cellSize, h * cellSize); ctx.stroke();
      }
    }

    // Edge Separators (Bold)
    if (config.showEdges) {
      ctx.beginPath(); ctx.moveTo(cellSize, 0); ctx.lineTo(cellSize, h * cellSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo((totalW - 1) * cellSize, 0); ctx.lineTo((totalW - 1) * cellSize, h * cellSize); ctx.stroke();
    }

    // Bold Horizontals
    for (let i = 0; i <= h; i += 10) {
      const y = h - i;
      ctx.beginPath(); ctx.moveTo(0, y * cellSize); ctx.lineTo(totalW * cellSize, y * cellSize); ctx.stroke();
    }

    // --- Row Numbers (Left + Right) ---
    ctx.font = `${rowLabelFontSize}px monospace`;
    ctx.textBaseline = "middle";
    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rightDotX = totalW * cellSize + 5;
      const leftDotX = -5;
      const cy = y * cellSize + cellSize / 2;
      const dotRadius = Math.max(1.5, Math.min(3, cellSize * 0.18));

      ctx.fillStyle = colorIdx === 0 ? colAHex : colBHex;
      ctx.beginPath(); ctx.arc(rightDotX, cy, dotRadius, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(leftDotX, cy, dotRadius, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#666";
      ctx.textAlign = "left";
      ctx.fillText(`${rowNum}`, rightDotX + 6, cy + 0.5);
      ctx.textAlign = "right";
      ctx.fillText(`${rowNum}`, leftDotX - 6, cy + 0.5);
    }

    // --- Column Numbers (Top + Bottom) ---
    ctx.textAlign = "center";
    ctx.fillStyle = "#666";
    ctx.font = `${colLabelFontSize}px monospace`;
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;

    for (let visualX = 0; visualX < totalW; visualX++) {
      let colNum;
      // Numbering starts at the start-side edge stitch.
      if (config.direction === "RtoL") {
        // Rightmost visible column is 1.
        colNum = totalW - visualX;
      } else {
        // Leftmost visible column is 1.
        colNum = visualX + 1;
      }

      const centerX = visualX * cellSize + cellSize / 2;
      const bottomY = h * cellSize + 4;
      const topY = -4;
      const labelY = bottomY + 2 + (useStaggeredColumnLabels && colNum % 2 === 0 ? colLabelFontSize + 1 : 0);
      const topLabelY = -6 - (useStaggeredColumnLabels && colNum % 2 === 0 ? colLabelFontSize + 1 : 0);

      // Bottom tick
      ctx.beginPath();
      ctx.moveTo(centerX, h * cellSize);
      ctx.lineTo(centerX, bottomY);
      ctx.stroke();

      // Top tick
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, topY);
      ctx.stroke();

      // Upright numbers, shown at both top and bottom.
      ctx.textBaseline = "top";
      ctx.fillText(`${colNum}`, centerX, labelY);
      ctx.textBaseline = "bottom";
      ctx.fillText(`${colNum}`, centerX, topLabelY);
    }

  }, [chart, cellSize, colA, colB, w, h, config, totalW, marginLeft, marginRight, marginTop, marginBottom, rowLabelFontSize, colLabelFontSize, useStaggeredColumnLabels]);

  useEffect(() => { draw(); }, [draw]);

  const getCell = (e) => {
    if (mode === "view") return null;
    const c = ref.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const mx = e.clientX - r.left - marginLeft;
    const my = e.clientY - r.top - marginTop;

    const visualX = Math.floor(mx / cellSize);
    const visualY = Math.floor(my / cellSize);

    const patternX = visualX - xOffset;
    if (patternX >= 0 && patternX < w && visualY >= 0 && visualY < h) {
      return { x: patternX, y: visualY };
    }
    return null;
  };

  const paint = (x, y) => {
    const g = chart.map(r => [...r]);
    const rowNum = h - y;
    const rowColorIdx = getRowColor(rowNum - 1); // 0=A, 1=B

    // Color tools: "colorA" places DC on color A rows, "colorB" on color B rows
    if (tool === "colorA" || tool === "colorB") {
      const wantColorIdx = tool === "colorA" ? 0 : 1;
      if (rowColorIdx === wantColorIdx) {
        // Correct color row — place a DC
        if (y === h - 1) { onRuleMessage?.("Rij 1 is altijd vaste (geen stokje toegestaan)."); return; }
        g[y][x] = true;
        // Remove conflicting adjacent DCs (new DC wins)
        if (y > 0 && g[y - 1][x]) g[y - 1][x] = false;
        if (y < h - 1 && g[y + 1][x]) g[y + 1][x] = false;
      } else {
        // Wrong color row — remove any DC here so the wanted color shows
        g[y][x] = false;
      }
      const { chart: fixed } = validateNoStacking(g);
      setChart(fixed);
      return;
    }

    const nextValue = tool === "symbol" ? true : tool === "erase" ? false : !g[y][x];

    if (nextValue && y === h - 1) {
      onRuleMessage?.("Rij 1 is altijd vaste (geen stokje toegestaan).");
      return;
    }

    g[y][x] = nextValue;
    // When placing a DC, the new one always wins over adjacent conflicts
    if (nextValue) {
      if (y > 0 && g[y - 1][x]) g[y - 1][x] = false;
      if (y < h - 1 && g[y + 1][x]) g[y + 1][x] = false;
    }
    const { chart: fixed, fixes } = validateNoStacking(g);

    if (nextValue && !fixed[y][x]) {
      onRuleMessage?.("Hier kan geen stokje: in de aangrenzende rij moet dit een vaste blijven.");
    } else if (nextValue && fixes > 0) {
      onRuleMessage?.("Stokje-op-stokje gecorrigeerd volgens overlay-regel.");
    }

    setChart(fixed);
  };

  const onDown = (e) => {
    if (mode !== "edit") return;
    e.preventDefault(); drawing.current = true;
    onDrawStart?.();
    const c = getCell(e); if (c) { lastCell.current = c; paint(c.x, c.y); }
  };
  const onMove = (e) => {
    if (!drawing.current || mode !== "edit") return;
    const c = getCell(e);
    if (c && (!lastCell.current || c.x !== lastCell.current.x || c.y !== lastCell.current.y)) {
      lastCell.current = c; paint(c.x, c.y);
    }
  };
  const onUp = () => { drawing.current = false; lastCell.current = null; };

  return (
    <canvas ref={ref} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      style={{ cursor: mode === "edit" ? "crosshair" : "default", borderRadius: "6px", display: "block" }} />
  );
}

// ============================================================
// Mini Preview (visual result approximation)
// ============================================================
function VisualPreview({ chart, colA, colB }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !chart || !chart.length) return;
    const w = chart[0].length, h = chart.length;
    const s = Math.max(1, Math.min(3, Math.floor(280 / Math.max(w, h))));
    const c = ref.current;
    c.width = w * s; c.height = h * s;
    const ctx = c.getContext("2d");

    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowHex = colorIdx === 0 ? colA.hex : colB.hex;

      for (let x = 0; x < w; x++) {
        ctx.fillStyle = rowHex;
        ctx.fillRect(x * s, y * s, s, s);
      }
    }

    // Overlay pass: a DC on row N covers the cell below (next row).
    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowHex = colorIdx === 0 ? colA.hex : colB.hex;
      for (let x = 0; x < w; x++) {
        if (chart[y][x]) {
          ctx.fillStyle = rowHex;
          ctx.fillRect(x * s, y * s, s, s);
          if (y < h - 1) ctx.fillRect(x * s, (y + 1) * s, s, s);
        }
      }
    }
  }, [chart, colA, colB]);

  return <canvas ref={ref} style={{ width: "100%", imageRendering: "pixelated", borderRadius: "6px" }} />;
}

// ============================================================
// Main App
// ============================================================
export default function App() {
  const [step, setStep] = useState("upload");
  const [origImage, setOrigImage] = useState(null);
  const [imgEl, setImgEl] = useState(null);
  const [gridW, setGridW] = useState(140);
  const [gridH, setGridH] = useState(140);
  const [threshold, setThreshold] = useState(128);
  const [chart, setChart] = useState(null);
  const [fixCount, setFixCount] = useState(0);
  const [tool, setTool] = useState("toggle");
  const [cellSize, setCellSize] = useState(4);
  const [yarnPalette, setYarnPalette] = useState(() => loadColorPalette());
  const [colA, setColA] = useState({ ...DEFAULT_COLOR_A });
  const [colB, setColB] = useState({ ...DEFAULT_COLOR_B });
  const [calcUnit, setCalcUnit] = useState("cm");
  const [calcIncludesEdges, setCalcIncludesEdges] = useState(true);
  const [syncCalculatorToGrid, setSyncCalculatorToGrid] = useState(true);
  const [swatchWidth, setSwatchWidth] = useState(10);
  const [swatchHeight, setSwatchHeight] = useState(10);
  const [swatchStitches, setSwatchStitches] = useState(28);
  const [swatchRows, setSwatchRows] = useState(28);
  const [desiredWidth, setDesiredWidth] = useState(35);
  const [desiredHeight, setDesiredHeight] = useState(45);
  const [folders, setFolders] = useState(() => loadWorkspace().folders);
  const [savedCharts, setSavedCharts] = useState(() => loadWorkspace().charts);
  const [currentChartId, setCurrentChartId] = useState(null);
  const [chartTitle, setChartTitle] = useState("Nieuwe chart");
  const [chartFolderId, setChartFolderId] = useState(DEFAULT_FOLDER_ID);
  const [openMenu, setOpenMenu] = useState("");
  const [folderDraftName, setFolderDraftName] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("all");
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!hasSupabaseConfig);
  const [remoteLoaded, setRemoteLoaded] = useState(!hasSupabaseConfig);
  const [isHydratingRemote, setIsHydratingRemote] = useState(false);
  const [cloudSyncState, setCloudSyncState] = useState(hasSupabaseConfig ? "guest" : "local");
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 1024 : false));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ruleNotice, setRuleNotice] = useState("");
  const [printPaper, setPrintPaper] = useState("A4");
  const [printOrientation, setPrintOrientation] = useState("portrait");
  const [printMode, setPrintMode] = useState("multi");
  const [printMarginMm, setPrintMarginMm] = useState(8);
  const [printCellMm, setPrintCellMm] = useState(3.2);
  const [splitMode, setSplitMode] = useState("equal");
  const [splitCount, setSplitCount] = useState(3);
  const [splitRowSize, setSplitRowSize] = useState(50);
  const [splitPoints, setSplitPoints] = useState([]);
  const [activeSectionTab, setActiveSectionTab] = useState("full");
  const [pdfIntroText, setPdfIntroText] = useState("");
  const [pdfMaterialText, setPdfMaterialText] = useState("");
  const [pdfFinishText, setPdfFinishText] = useState("");
  const [pdfSubtitle, setPdfSubtitle] = useState("Overlay Mozaïek Deken");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfCoverImage, setPdfCoverImage] = useState(null); // data URL of cover photo
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveDraftTitle, setSaveDraftTitle] = useState("");
  const [saveDraftFolderId, setSaveDraftFolderId] = useState(DEFAULT_FOLDER_ID);
  const [editingLibraryId, setEditingLibraryId] = useState(null);
  const [editingLibraryTitle, setEditingLibraryTitle] = useState("");
  const [patternLanguage, setPatternLanguage] = useState("nl");
  const [patternTexts, setPatternTexts] = useState(() => loadTranslationConfig().texts);
  const [translationsLocked, setTranslationsLocked] = useState(() => loadTranslationConfig().locked);
  const [newLanguageCode, setNewLanguageCode] = useState("");
  const [newLanguageLabel, setNewLanguageLabel] = useState("");
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [translationsRemoteReady, setTranslationsRemoteReady] = useState(!hasSupabaseConfig);
  const [isHydratingTranslations, setIsHydratingTranslations] = useState(false);
  const [translationCloudStatus, setTranslationCloudStatus] = useState(hasSupabaseConfig ? "loading" : "local");
  const ruleNoticeTimer = useRef(null);

  // Undo/Redo history
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const MAX_HISTORY = 50;

  // Project Settings
  const [projConfig, setProjConfig] = useState({
    direction: "RtoL", // "RtoL" | "LtoR"
    showEdges: true,
  });

  const previewRef = useRef(null);
  const selectableFolders = folders.filter(f => f.id !== DELETED_FOLDER_ID);
  const findFolderName = (id) => folders.find(f => f.id === id)?.name || "Onbekend";
  const cloudStatusLabel = {
    local: "Lokaal",
    guest: "Niet ingelogd",
    syncing: "Synchroniseert",
    cloud: "Cloud actief",
    cloud_error: "Cloud fout",
    setup_needed: "Setup nodig",
  }[cloudSyncState] || "Onbekend";
  const cloudStatusColor = {
    local: "#9FA3A7",
    guest: "#9FA3A7",
    syncing: "#E97F32",
    cloud: "#279A4B",
    cloud_error: "#C63713",
    setup_needed: "#C63713",
  }[cloudSyncState] || "#9FA3A7";
  const translationCloudLabel = {
    local: "Lokaal",
    loading: "Laadt",
    cloud: "Globaal in cloud",
    setup_needed: "Setup nodig",
    error: "Cloud fout",
  }[translationCloudStatus] || "Onbekend";

  const showRuleNotice = useCallback((message) => {
    if (!message) return;
    setRuleNotice(message);
    if (ruleNoticeTimer.current) clearTimeout(ruleNoticeTimer.current);
    ruleNoticeTimer.current = setTimeout(() => setRuleNotice(""), 2800);
  }, []);

  const applyValidatedChart = useCallback((nextChart, options = {}) => {
    if (!Array.isArray(nextChart) || !nextChart.length) {
      setChart(nextChart);
      return 0;
    }

    const { chart: fixedChart, fixes } = validateNoStacking(nextChart);
    setChart(fixedChart);

    if (options.notify) {
      if (fixes > 0) {
        showRuleNotice(`${fixes} vakje(s) aangepast volgens overlay-regels.`);
      } else if (options.successMessage) {
        showRuleNotice(options.successMessage);
      }
    }

    return fixes;
  }, [showRuleNotice]);

  // Undo/Redo functions
  const pushHistory = useCallback((chartSnapshot) => {
    if (!chartSnapshot) return;
    const copy = chartSnapshot.map(r => [...r]);
    const idx = historyIndexRef.current;
    // Trim future states if we branched
    historyRef.current = historyRef.current.slice(0, idx + 1);
    historyRef.current.push(copy);
    // Enforce max history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current = historyRef.current.slice(historyRef.current.length - MAX_HISTORY);
    }
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    // Save current state at the end if we're at the tip
    if (historyIndexRef.current === historyRef.current.length - 1 && chart) {
      const currentCopy = chart.map(r => [...r]);
      // Only push if different from last saved
      const last = historyRef.current[historyRef.current.length - 1];
      const isDiff = !last || last.length !== currentCopy.length || last.some((r, i) => r.some((c, j) => c !== currentCopy[i][j]));
      if (isDiff) {
        historyRef.current.push(currentCopy);
        historyIndexRef.current = historyRef.current.length - 1;
      }
    }
    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (snapshot) setChart(snapshot.map(r => [...r]));
  }, [chart]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (snapshot) setChart(snapshot.map(r => [...r]));
  }, []);

  const canUndo = historyRef.current.length > 0 && historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const languageEntries = Object.entries(patternTexts);
  const applyPaletteColor = useCallback((entry, setColor, fallback) => {
    if (!entry) return;
    setColor(normalizeActiveColor(entry, fallback));
  }, []);

  const saveColorToPalette = useCallback((color) => {
    const normalized = normalizePaletteEntry(color, 0);
    if (!normalized) {
      alert("Kies een geldige kleurcode (#RRGGBB) om op te slaan in het palet.");
      return;
    }
    const lockedConflict = yarnPalette.find((entry) =>
      entry.locked && entry.name.toLowerCase() === normalized.name.toLowerCase() && entry.hex !== normalized.hex,
    );
    if (lockedConflict) {
      alert(`'${lockedConflict.name}' is een basispalet-kleur en kan niet overschreven worden.`);
      return;
    }
    setYarnPalette(prev => upsertPaletteWithColor(prev, normalized));
  }, [yarnPalette]);

  const renamePaletteEntry = useCallback((index) => {
    const entry = yarnPalette[index];
    if (!entry) return;
    if (entry.locked) {
      alert("Basispalet-kleuren zijn vergrendeld en kunnen niet hernoemd worden.");
      return;
    }
    const nextName = window.prompt("Nieuwe kleurnaam", entry.name);
    if (!nextName || !nextName.trim()) return;
    const cleanName = nextName.trim();
    const duplicate = yarnPalette.some((item, itemIdx) => itemIdx !== index && item.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
      alert("Er bestaat al een kleur met deze naam.");
      return;
    }
    setYarnPalette(prev => {
      if (!prev[index] || prev[index].locked) return prev;
      const next = [...prev];
      next[index] = { ...next[index], name: cleanName, locked: false };
      return next;
    });
  }, [yarnPalette]);

  const removePaletteEntry = useCallback((index) => {
    const entry = yarnPalette[index];
    if (!entry) return;
    if (entry.locked) {
      alert("Basispalet-kleuren zijn vergrendeld en kunnen niet verwijderd worden.");
      return;
    }
    if (!window.confirm(`Kleur '${entry.name}' verwijderen uit palet?`)) return;
    setYarnPalette(prev => prev.filter((_item, itemIdx) => itemIdx !== index));
  }, [yarnPalette]);

  const resetCustomPalette = useCallback(() => {
    if (!window.confirm("Alle aangepaste paletkleuren verwijderen en alleen basispalet behouden?")) return;
    setYarnPalette(DEFAULT_YARN_PALETTE.map((entry, idx) => normalizePaletteEntry({ ...entry, locked: true }, idx)).filter(Boolean));
  }, []);

  const updateTranslationValue = useCallback((lang, field, value) => {
    if (translationsLocked) return;
    setPatternTexts(prev => ({
      ...prev,
      [lang]: {
        ...(prev[lang] || normalizePatternTexts(null).nl),
        [field]: value,
      },
    }));
  }, [translationsLocked]);

  const addTranslationLanguage = useCallback(() => {
    if (translationsLocked) return;
    const code = newLanguageCode.trim().toLowerCase();
    if (!code.match(/^[a-z]{2,5}$/)) {
      alert("Gebruik een taalcode met 2-5 letters, bijvoorbeeld: fr, es, it.");
      return;
    }
    if (patternTexts[code]) {
      alert("Deze taalcode bestaat al.");
      return;
    }
    const label = newLanguageLabel.trim() || code.toUpperCase();
    setPatternTexts(prev => ({
      ...prev,
      [code]: { ...normalizePatternTexts(null).nl, label },
    }));
    setPatternLanguage(code);
    setNewLanguageCode("");
    setNewLanguageLabel("");
  }, [newLanguageCode, newLanguageLabel, patternTexts]);

  const removeTranslationLanguage = useCallback((lang) => {
    if (translationsLocked) return;
    if (lang === "nl") {
      alert("Nederlands is de fallback en kan niet verwijderd worden.");
      return;
    }
    if (!window.confirm(`Taal '${lang}' verwijderen?`)) return;
    setPatternTexts(prev => {
      const next = { ...prev };
      delete next[lang];
      return next;
    });
    if (patternLanguage === lang) setPatternLanguage("nl");
  }, [patternLanguage, translationsLocked]);

  const toggleTranslationsLock = useCallback(() => {
    if (translationsLocked && hasSupabaseConfig && !user) {
      alert("Log in om de globale vertaaltabel te bewerken.");
      return;
    }
    setTranslationsLocked(prev => !prev);
  }, [translationsLocked, user]);

  const resetTranslationsToDefault = useCallback(() => {
    if (translationsLocked) return;
    if (!window.confirm("Alle aangepaste vertalingen terugzetten naar de standaard?")) return;
    setPatternTexts(normalizePatternTexts(null));
    setPatternLanguage("nl");
    setTranslationsLocked(true);
  }, [translationsLocked]);

  useEffect(() => () => {
    if (ruleNoticeTimer.current) clearTimeout(ruleNoticeTimer.current);
  }, []);

  useEffect(() => {
    saveColorPalette(yarnPalette);
  }, [yarnPalette]);

  useEffect(() => {
    saveTranslationConfig(patternTexts, translationsLocked);
  }, [patternTexts, translationsLocked]);

  useEffect(() => {
    if (!patternTexts[patternLanguage]) setPatternLanguage("nl");
  }, [patternTexts, patternLanguage]);

  // Undo/Redo keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (step !== "edit") return;
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (isMod && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      if (isMod && e.key === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, undo, redo]);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase || !authReady) return;
    let active = true;
    const loadRemoteTranslations = async () => {
      setIsHydratingTranslations(true);
      const { data, error } = await supabase
        .from(GLOBAL_TRANSLATIONS_TABLE)
        .select("texts, locked")
        .eq("id", GLOBAL_TRANSLATIONS_ID)
        .maybeSingle();

      if (!active) return;
      if (error) {
        if (error.code === "42P01") {
          setTranslationCloudStatus("setup_needed");
        } else {
          setTranslationCloudStatus("error");
        }
      } else {
        if (data?.texts) {
          setPatternTexts(normalizePatternTexts(data.texts));
          if (typeof data.locked === "boolean") setTranslationsLocked(data.locked);
        }
        setTranslationCloudStatus("cloud");
      }
      setTranslationsRemoteReady(true);
      setIsHydratingTranslations(false);
    };
    loadRemoteTranslations();
    return () => { active = false; };
  }, [authReady, user]);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase || !authReady || !translationsRemoteReady || isHydratingTranslations) return;
    if (!user) return;
    const timer = setTimeout(async () => {
      const { error } = await supabase
        .from(GLOBAL_TRANSLATIONS_TABLE)
        .upsert({
          id: GLOBAL_TRANSLATIONS_ID,
          texts: patternTexts,
          locked: translationsLocked,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        });
      if (error) {
        if (error.code === "42P01") setTranslationCloudStatus("setup_needed");
        else setTranslationCloudStatus("error");
      } else {
        setTranslationCloudStatus("cloud");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [patternTexts, translationsLocked, user, authReady, translationsRemoteReady, isHydratingTranslations]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Close "bestand" dropdown on click outside
  useEffect(() => {
    if (openMenu !== "bestand") return;
    const handler = () => setOpenMenu("");
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openMenu]);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setAuthReady(true);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user || null);
      setAuthReady(true);
      setCloudSyncState(data.session?.user ? "syncing" : "guest");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user || null);
      setCloudSyncState(session?.user ? "syncing" : "guest");
      setRemoteLoaded(false);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase || !authReady) return;
    if (!user) {
      const local = loadWorkspace();
      setFolders(local.folders);
      setSavedCharts(local.charts);
      setRemoteLoaded(true);
      setCloudSyncState("guest");
      return;
    }

    let active = true;
    const loadRemoteWorkspace = async () => {
      setIsHydratingRemote(true);
      setCloudSyncState("syncing");
      const { data, error } = await supabase
        .from("workspaces")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;
      if (error) {
        setCloudSyncState(error.code === "42P01" ? "setup_needed" : "cloud_error");
      } else {
        const remoteFolders = Array.isArray(data?.data?.folders) ? data.data.folders : null;
        const remoteCharts = Array.isArray(data?.data?.charts) ? data.data.charts : null;
        if (remoteFolders && remoteCharts) {
          const folderIds = new Set(remoteFolders.map(f => f.id));
          const normalizedFolders = [...remoteFolders];
          for (const f of DEFAULT_FOLDERS) {
            if (!folderIds.has(f.id)) normalizedFolders.push(f);
          }
          setFolders(normalizedFolders);
          setSavedCharts(remoteCharts);
        }
        setCloudSyncState("cloud");
      }
      setRemoteLoaded(true);
      setIsHydratingRemote(false);
    };

    loadRemoteWorkspace();
    return () => { active = false; };
  }, [user, authReady]);

  useEffect(() => {
    saveWorkspace(folders, savedCharts);
  }, [folders, savedCharts]);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase || !user || !remoteLoaded || isHydratingRemote || !authReady) return;
    const timer = setTimeout(async () => {
      setCloudSyncState("syncing");
      const { error } = await supabase
        .from("workspaces")
        .upsert({
          user_id: user.id,
          data: { folders, charts: savedCharts },
          updated_at: new Date().toISOString(),
        });
      if (error) {
        setCloudSyncState(error.code === "42P01" ? "setup_needed" : "cloud_error");
      } else {
        setCloudSyncState("cloud");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [folders, savedCharts, user, remoteLoaded, isHydratingRemote, authReady]);

  const upsertSavedChart = (record) => {
    setSavedCharts(prev => {
      const exists = prev.some(c => c.id === record.id);
      return exists ? prev.map(c => c.id === record.id ? record : c) : [record, ...prev];
    });
  };

  const renameLocalChart = (chartId, newTitle) => {
    if (!newTitle.trim()) return;
    setSavedCharts(prev => prev.map(c =>
      c.id === chartId ? { ...c, title: newTitle.trim(), updatedAt: new Date().toISOString() } : c
    ));
    setEditingLibraryId(null);
    setEditingLibraryTitle("");
  };

  const buildCurrentChartRecord = (overrides = {}) => {
    if (!chart) return null;
    const now = new Date().toISOString();
    const recordId = overrides.id || currentChartId || `chart-${Date.now()}`;
    const existing = savedCharts.find(c => c.id === recordId);
    const fallbackFolderId = selectableFolders[0]?.id || DEFAULT_FOLDER_ID;
    const base = {
      id: recordId,
      title: (chartTitle || "Nieuwe chart").trim() || "Nieuwe chart",
      folderId: chartFolderId || fallbackFolderId,
      previousFolderId: existing?.previousFolderId || null,
      isDeleted: false,
      deletedAt: null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      gridW,
      gridH,
      threshold,
      chart: chart.map(r => [...r]),
      cellSize,
      colA: { ...colA },
      colB: { ...colB },
      projConfig: { ...projConfig },
      calcUnit,
      calcIncludesEdges,
      swatchWidth,
      swatchHeight,
      swatchStitches,
      swatchRows,
      desiredWidth,
      desiredHeight,
    };
    return { ...base, ...overrides, id: recordId, updatedAt: now };
  };

  const saveCurrentChart = () => {
    if (!chart) {
      alert("Er is nog geen teltekening om op te slaan.");
      return;
    }
    // Open modal met huidige waarden
    setSaveDraftTitle(chartTitle);
    setSaveDraftFolderId(chartFolderId);
    setShowSaveModal(true);
  };

  const confirmSaveChart = () => {
    if (!saveDraftTitle.trim()) {
      alert("Geef je patroon een naam.");
      return;
    }
    // Update de state met de nieuwe waarden
    setChartTitle(saveDraftTitle.trim());
    setChartFolderId(saveDraftFolderId);
    // Bouw en sla het record op
    const record = buildCurrentChartRecord({
      title: saveDraftTitle.trim(),
      folderId: saveDraftFolderId,
    });
    if (!record) return;
    upsertSavedChart(record);
    setCurrentChartId(record.id);
    setShowSaveModal(false);
    alert("Chart opgeslagen.");
  };

  const newChart = () => {
    setCurrentChartId(null);
    setChartTitle("Nieuwe chart");
    setChartFolderId(DEFAULT_FOLDER_ID);
    setOrigImage(null);
    setImgEl(null);
    setChart(null);
    setFixCount(0);
    setStep("upload");
    setOpenMenu("");
  };

  const openSavedChart = (record) => {
    const now = Date.now();
    const deletedAt = record?.deletedAt ? new Date(record.deletedAt).getTime() : null;
    const isExpiredDeleted = record?.isDeleted && deletedAt && (now - deletedAt > ONE_WEEK_MS);
    if (isExpiredDeleted) {
      alert("Deze verwijderde chart is ouder dan 7 dagen en kan niet meer automatisch worden hersteld.");
      return;
    }

    let nextRecord = record;
    if (record?.isDeleted && withinRestoreWindow(record)) {
      const restoredFolderId = folders.some(f => f.id === record.previousFolderId) ? record.previousFolderId : DEFAULT_FOLDER_ID;
      nextRecord = {
        ...record,
        isDeleted: false,
        deletedAt: null,
        folderId: restoredFolderId,
        updatedAt: new Date().toISOString(),
      };
      upsertSavedChart(nextRecord);
    }

    setCurrentChartId(nextRecord.id);
    setChartTitle(nextRecord.title || "Nieuwe chart");
    setChartFolderId(nextRecord.folderId || DEFAULT_FOLDER_ID);
    setGridW(nextRecord.gridW || 140);
    setGridH(nextRecord.gridH || 140);
    setThreshold(nextRecord.threshold || 128);
    if (Array.isArray(nextRecord.chart)) {
      const loadedChart = nextRecord.chart.map(r => [...r]);
      const { chart: fixedLoadedChart, fixes } = validateNoStacking(loadedChart);
      setChart(fixedLoadedChart);
      setFixCount(fixes);
      if (fixes > 0) {
        showRuleNotice(`${fixes} vakje(s) bij laden aangepast volgens overlay-regels.`);
      }
    } else {
      setChart(null);
      setFixCount(0);
    }
    setCellSize(nextRecord.cellSize || 4);
    setColA(normalizeActiveColor(nextRecord.colA, DEFAULT_COLOR_A));
    setColB(normalizeActiveColor(nextRecord.colB, DEFAULT_COLOR_B));
    setProjConfig(nextRecord.projConfig || { direction: "RtoL", showEdges: true });
    setCalcUnit(nextRecord.calcUnit || "cm");
    setCalcIncludesEdges(typeof nextRecord.calcIncludesEdges === "boolean" ? nextRecord.calcIncludesEdges : true);
    setSwatchWidth(nextRecord.swatchWidth || 10);
    setSwatchHeight(nextRecord.swatchHeight || 10);
    setSwatchStitches(nextRecord.swatchStitches || 28);
    setSwatchRows(nextRecord.swatchRows || 28);
    setDesiredWidth(nextRecord.desiredWidth || 35);
    setDesiredHeight(nextRecord.desiredHeight || 45);
    setOrigImage(null);
    setImgEl(null);
    setStep("edit");
    setOpenMenu("");
  };

  const deleteCurrentChart = () => {
    if (!chart) {
      alert("Er is geen actieve chart om te verwijderen.");
      return;
    }
    const record = buildCurrentChartRecord();
    if (!record) return;
    const deletedRecord = {
      ...record,
      previousFolderId: record.folderId || DEFAULT_FOLDER_ID,
      folderId: DELETED_FOLDER_ID,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertSavedChart(deletedRecord);
    newChart();
  };

  const addFolder = () => {
    const name = folderDraftName.trim();
    if (!name) return;
    const id = `folder-${Date.now()}`;
    setFolders(prev => [...prev, { id, name, system: false }]);
    setFolderDraftName("");
  };

  const renameFolder = (folderId) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder || folder.system) return;
    const name = window.prompt("Nieuwe mapnaam", folder.name);
    if (!name || !name.trim()) return;
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: name.trim() } : f));
  };

  const removeFolder = (folderId) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder || folder.system) return;
    setFolders(prev => prev.filter(f => f.id !== folderId));
    setSavedCharts(prev => prev.map(c => {
      if (c.folderId === folderId) return { ...c, folderId: DEFAULT_FOLDER_ID };
      if (c.previousFolderId === folderId) return { ...c, previousFolderId: DEFAULT_FOLDER_ID };
      return c;
    }));
    if (chartFolderId === folderId) setChartFolderId(DEFAULT_FOLDER_ID);
  };

  const signInWithEmailPassword = async () => {
    if (!supabase) return;
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || !password) {
      alert("Vul e-mailadres en wachtwoord in.");
      return;
    }
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);
    if (error) {
      if (error.message?.toLowerCase().includes("invalid login credentials")) {
        alert("Onjuiste inloggegevens.");
      } else {
        alert(`Inloggen mislukt: ${error.message}`);
      }
      return;
    }
    setOpenMenu("");
    setAuthPassword("");
    setCloudSyncState("syncing");
  };

  const signUpWithEmailPassword = async () => {
    if (!supabase) return;
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || !password) {
      alert("Vul e-mailadres en wachtwoord in.");
      return;
    }
    if (password.length < 6) {
      alert("Wachtwoord moet minimaal 6 tekens bevatten.");
      return;
    }
    setAuthBusy(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setAuthBusy(false);
    if (error) {
      alert(`Registreren mislukt: ${error.message}`);
      return;
    }
    setAuthPassword("");
    if (data?.session) {
      setOpenMenu("");
      setCloudSyncState("syncing");
      return;
    }
    alert("Account aangemaakt. Controleer je e-mail voor bevestiging en log daarna in.");
    setAuthMode("signin");
  };

  const signOutUser = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    const local = loadWorkspace();
    setFolders(local.folders);
    setSavedCharts(local.charts);
    setCloudSyncState("guest");
  };

  const calculatorResult = (() => {
    if (
      swatchWidth <= 0 || swatchHeight <= 0 ||
      swatchStitches <= 0 || swatchRows <= 0 ||
      desiredWidth <= 0 || desiredHeight <= 0
    ) return null;

    const gaugeW = swatchStitches / swatchWidth;
    const gaugeH = swatchRows / swatchHeight;
    const calculatedColumns = Math.max(1, Math.round(desiredWidth * gaugeW));
    const calculatedRows = Math.max(1, Math.round(desiredHeight * gaugeH));
    const subtractEdgeCols = projConfig.showEdges && calcIncludesEdges ? 2 : 0;
    const targetPatternColumns = Math.max(1, calculatedColumns - subtractEdgeCols);
    const targetTotalColumns = targetPatternColumns + (projConfig.showEdges ? 2 : 0);
    const calculatorTotalStitches = calculatedColumns * calculatedRows;
    const appliedTotalStitches = targetTotalColumns * calculatedRows;
    const currentTotalColumns = projConfig.showEdges ? gridW + 2 : gridW;
    const currentComparableColumns = calcIncludesEdges ? currentTotalColumns : gridW;
    const currentWidth = currentComparableColumns / gaugeW;
    const currentHeight = gridH / gaugeH;

    return {
      gaugeW,
      gaugeH,
      calculatedColumns,
      calculatedRows,
      targetPatternColumns,
      targetTotalColumns,
      calculatorTotalStitches,
      appliedTotalStitches,
      currentWidth,
      currentHeight,
      currentTotalColumns,
    };
  })();

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setOrigImage(ev.target.result);
      const img = new Image();
      img.onload = () => {
        setImgEl(img);
        const ratio = img.height / img.width;
        setGridH(Math.round(gridW * ratio));
        setStep("adjust");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (step !== "adjust" || !previewRef.current || !imgEl) return;
    const { chart: preview } = imageToChart(imgEl, gridW, gridH, threshold);
    const c = previewRef.current;
    const ctx = c.getContext("2d");
    const edgeCols = projConfig.showEdges ? 2 : 0;
    const totalCols = gridW + edgeCols;
    const xOffset = projConfig.showEdges ? 1 : 0;
    const s = Math.max(1, Math.min(4, Math.floor(450 / Math.max(totalCols, gridH))));
    c.width = totalCols * s; c.height = gridH * s;
    for (let y = 0; y < gridH; y++) {
      const rowNum = gridH - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowHex = colorIdx === 0 ? colA.hex : colB.hex;

      if (projConfig.showEdges) {
        ctx.fillStyle = rowHex;
        ctx.fillRect(0, y * s, s, s);
        ctx.fillRect((totalCols - 1) * s, y * s, s, s);
      }

      for (let x = 0; x < gridW; x++) {
        ctx.fillStyle = rowHex;
        ctx.fillRect((xOffset + x) * s, y * s, s, s);
      }
    }

    // Overlay in preview: symbol cells are shown as 2 cells high in the same row color.
    for (let y = 0; y < gridH; y++) {
      const rowNum = gridH - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowHex = colorIdx === 0 ? colA.hex : colB.hex;
      for (let x = 0; x < gridW; x++) {
        if (!preview[y][x]) continue;
        const vx = xOffset + x;
        ctx.fillStyle = rowHex;
        ctx.fillRect(vx * s, y * s, s, s);
        if (y < gridH - 1) ctx.fillRect(vx * s, (y + 1) * s, s, s);
      }
    }
  }, [step, imgEl, gridW, gridH, threshold, colA, colB, projConfig.showEdges]);

  useEffect(() => {
    if (step !== "adjust" || !syncCalculatorToGrid || !calculatorResult) return;
    const targetW = calculatorResult.targetPatternColumns;
    const targetH = calculatorResult.calculatedRows;
    if (gridW !== targetW) setGridW(targetW);
    if (gridH !== targetH) setGridH(targetH);
  }, [step, syncCalculatorToGrid, calculatorResult, gridW, gridH]);

  const confirmGrid = () => {
    const { chart: c, fixes } = imageToChart(imgEl, gridW, gridH, threshold);
    setChart(c);
    setFixCount(fixes);
    setCellSize(Math.max(2, Math.min(10, Math.floor(900 / Math.max(gridW, gridH)))));
    setStep("edit");
  };

  const applyCalculatedSize = () => {
    if (!calculatorResult) return;
    setGridW(calculatorResult.targetPatternColumns);
    setGridH(calculatorResult.calculatedRows);
  };

  const patternText = patternTexts[patternLanguage] || patternTexts.nl || normalizePatternTexts(null).nl;
  const patternRows = chart ? generateWrittenPattern(chart, colA, colB, projConfig.direction, patternText) : [];
  const printLayout = chart
    ? computePrintLayout({
      chartWidth: chart[0].length,
      chartHeight: chart.length,
      showEdges: projConfig.showEdges,
      paper: printPaper,
      orientation: printOrientation,
      marginMm: printMarginMm,
      mode: printMode,
      cellMm: printCellMm,
    })
    : null;

  const stats = chart ? {
    symbols: chart.flat().filter(c => c).length,
    plain: chart.flat().filter(c => !c).length,
    total: chart.flat().length,
  } : {};

  const canGoToStep = {
    upload: true,
    adjust: !!imgEl,
    edit: !!chart,
    pattern: !!chart,
  };

  // Stitch statistics for right sidebar
  const stitchStats = useMemo(() => {
    if (!chart || !chart.length) return null;
    const h = chart.length, w = chart[0].length;
    const totalCells = h * w;
    let dcCount = 0;
    let colorACells = 0, colorBCells = 0;
    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const isColorA = getRowColor(rowNum - 1) === 0;
      for (let x = 0; x < w; x++) {
        if (chart[y][x]) dcCount++;
        if (isColorA) colorACells++; else colorBCells++;
      }
    }
    const scCount = totalCells - dcCount;
    return {
      totalCells, dcCount, scCount,
      colorACells, colorBCells,
      colorAPercent: ((colorACells / totalCells) * 100).toFixed(0),
      colorBPercent: ((colorBCells / totalCells) * 100).toFixed(0),
    };
  }, [chart]);

  const chartSections = useMemo(() => {
    if (!chart) return [];
    const h = chart.length;
    let cuts = [];
    if (splitMode === "equal") {
      const size = Math.ceil(h / splitCount);
      for (let i = 1; i < splitCount; i++) cuts.push(Math.min(i * size, h));
    } else if (splitMode === "fixed") {
      for (let r = splitRowSize; r < h; r += splitRowSize) cuts.push(r);
    } else {
      cuts = [...splitPoints].sort((a, b) => a - b);
    }
    const sections = [];
    let prev = 0;
    for (const cut of cuts) {
      if (cut > prev && cut < h) {
        sections.push({ startRow: prev, endRow: cut });
        prev = cut;
      }
    }
    sections.push({ startRow: prev, endRow: h });
    return sections.map((s, i) => ({
      ...s,
      label: `Deel ${i + 1} van ${sections.length}`,
      chartSlice: chart.slice(s.startRow, s.endRow),
      rowOffset: s.startRow,
    }));
  }, [chart, splitMode, splitCount, splitRowSize, splitPoints]);

  const sectionedPatternRows = useMemo(() => {
    if (!chart || chartSections.length <= 1) return null;
    return chartSections.map(s => ({
      ...s,
      rows: generateWrittenPattern(chart, colA, colB, projConfig.direction, patternText, s.startRow, s.endRow),
    }));
  }, [chart, chartSections, colA, colB, projConfig.direction, patternText]);

  const goToStep = (nextStep) => {
    if (!canGoToStep[nextStep]) return;
    setOpenMenu("");
    setStep(nextStep);
    if (isMobile) setSidebarOpen(false);
  };

  const toggleMenuPanel = (panel) => {
    setOpenMenu(prev => (prev === panel ? "" : panel));
    if (isMobile) setSidebarOpen(false);
  };

  const sidebarStepItems = [
    { id: "upload", icon: "upload", label: "1. Upload", enabled: true },
    { id: "adjust", icon: "adjust", label: "2. Conversie", enabled: !!imgEl },
    { id: "edit", icon: "edit", label: "3. Bewerken", enabled: !!chart },
    { id: "pattern", icon: "pattern", label: "4. Patroon", enabled: !!chart },
  ];

  const filteredCharts = [...savedCharts]
    .filter(c => {
      if (libraryFilter === "all") return !c.isDeleted;
      if (libraryFilter === "deleted") return c.isDeleted;
      return c.folderId === libraryFilter && !c.isDeleted;
    })
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

  const sidebarContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", minHeight: isMobile ? "auto" : "calc(100vh - 128px)" }}>
      <div style={sidebarSection}>
        <div style={sidebarTitle}>Workflow</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {sidebarStepItems.map(item => (
            <button
              key={item.id}
              onClick={() => goToStep(item.id)}
              disabled={!item.enabled}
              style={{
                ...btnSidebar,
                borderColor: step === item.id ? B.orange : B.border,
                color: step === item.id ? B.orange : B.dark,
                background: step === item.id ? B.cream : B.white,
                opacity: item.enabled ? 1 : 0.45,
                cursor: item.enabled ? "pointer" : "not-allowed",
              }}
            >
              <span style={sidebarIconWrap} aria-hidden="true"><MenuIcon name={item.icon} /></span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={sidebarSection}>
        <div style={sidebarTitle}>Bestand</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button style={btnSidebar} onClick={() => { newChart(); if (isMobile) setSidebarOpen(false); }}>
            <span style={sidebarIconWrap} aria-hidden="true"><MenuIcon name="new" /></span><span>Nieuw chart</span>
          </button>
          <button style={btnSidebar} onClick={() => { saveCurrentChart(); if (isMobile) setSidebarOpen(false); }}>
            <span style={sidebarIconWrap} aria-hidden="true"><MenuIcon name="save" /></span><span>Opslaan</span>
          </button>
          <button style={btnSidebar} onClick={() => toggleMenuPanel("settings")}>
            <span style={sidebarIconWrap} aria-hidden="true"><MenuIcon name="settings" /></span><span>Chart instellingen</span>
          </button>
          <button style={btnSidebar} onClick={() => toggleMenuPanel("library")}>
            <span style={sidebarIconWrap} aria-hidden="true"><MenuIcon name="library" /></span><span>Bibliotheek</span>
          </button>
          <button style={btnSidebar} onClick={() => toggleMenuPanel("folders")}>
            <span style={sidebarIconWrap} aria-hidden="true"><MenuIcon name="folders" /></span><span>Mappen beheren</span>
          </button>
          {hasSupabaseConfig && (
            <button
              style={btnSidebar}
              onClick={() => {
                if (user) signOutUser();
                else toggleMenuPanel("auth");
                if (isMobile) setSidebarOpen(false);
              }}
            >
              <span style={sidebarIconWrap} aria-hidden="true"><MenuIcon name={user ? "logout" : "login"} /></span>
              <span>{user ? "Uitloggen" : "Inloggen"}</span>
            </button>
          )}
          <button style={{ ...btnSidebar, borderColor: "#d55", color: "#a11" }} onClick={() => { deleteCurrentChart(); if (isMobile) setSidebarOpen(false); }}>
            <span style={sidebarIconWrap} aria-hidden="true"><MenuIcon name="delete" /></span><span>Weggooien</span>
          </button>
        </div>
      </div>

      <div style={sidebarSection}>
        <div style={sidebarTitle}>Instellingen</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button style={btnSidebar} onClick={() => toggleMenuPanel("palette")}>
            <span style={sidebarIconWrap} aria-hidden="true"><MenuIcon name="palette" /></span><span>Garenpalet</span>
          </button>
          <button style={btnSidebar} onClick={() => toggleMenuPanel("translations")}>
            <span style={sidebarIconWrap} aria-hidden="true"><MenuIcon name="translate" /></span><span>Vertaaltabel</span>
          </button>
        </div>
      </div>

      {hasSupabaseConfig && (
        <div style={sidebarCloudCard}>
          <div style={sidebarCloudHeader}>
            <span style={{ ...sidebarCloudDot, background: cloudStatusColor }} />
            <span style={sidebarCloudTitle}>Cloud status</span>
          </div>
          <div style={sidebarCloudState}>{cloudStatusLabel}</div>
          <div style={sidebarCloudText}>
            {user ? `Ingelogd als ${user.email || "gebruiker"}` : "Log in om cloudopslag en synchronisatie te gebruiken."}
          </div>
        </div>
      )}
    </div>
  );

  const exportText = () => {
    const t = patternText;
    const hdr = [
      `${t.headerTitle}`,
      `${templateText(t.dimensionsTemplate, { w: gridW, h: gridH })}`,
      `${t.directionLabel}: ${projConfig.direction === "RtoL" ? t.directionRtoL : t.directionLtoR}`,
      ``,
      `${t.colorsTitle}`,
      `  ${templateText(t.colorAInfoTemplate, { name: colA.name })}`,
      `  ${templateText(t.colorBInfoTemplate, { name: colB.name })}`,
      ``,
      `${t.stitchesTitle}`,
      `  ${t.scInfo}`,
      `  ${t.dcInfo}`,
      `  ${t.edgeInfo}`,
      ``,
      `${templateText(t.startLine1Template, { name: colA.name, chainCount: gridW + 3 })}`,
      `${templateText(t.startLine2Template, { stitchCount: gridW + 2 })}`,
      ``,
      `${t.writtenTitle}:`,
      ``,
    ].join("\n");
    let body;
    if (sectionedPatternRows && sectionedPatternRows.length > 1) {
      const parts = sectionedPatternRows.map(sec =>
        `=== ${sec.label.toUpperCase()} (rij ${chart.length - sec.endRow + 1}–${chart.length - sec.startRow}) ===\n\n` + sec.rows.join("\n")
      );
      body = parts.join("\n\n") + "\n\n=== VOLLEDIG PATROON ===\n\n" + patternRows.join("\n");
    } else {
      body = patternRows.join("\n");
    }
    const txt = hdr + body;
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${t.fileName}.txt`; a.click();
  };

  // ============================================================
  // PDF Generator — Generates branded YarnZoo pattern PDF
  // ============================================================
  const generatePatternPDF = async () => {
    if (!chart || !patternRows || patternRows.length === 0) {
      alert("Er is geen patroon om te exporteren als PDF.");
      return;
    }
    setPdfGenerating(true);
    try {
      // --- Font & asset loading ---
      const [sketchMod, logoMod, paperMod] = await Promise.all([
        import("./fonts/KGSecondChancesSolid.js"),
        import("./fonts/LogoBlack.js"),
        import("./fonts/PaperTexture.js"),
      ]);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      // Register SketchSolid for headings (Helvetica used for body text)
      doc.addFileToVFS("KGSecondChancesSolid.ttf", sketchMod.KGSecondChancesSolidFont);
      doc.addFont("KGSecondChancesSolid.ttf", "SketchSolid", "normal");
      const logoDataUrl = logoMod.LogoBlackPNG;
      const paperDataUrl = paperMod.PaperTextureJPG;

      const pw = 210, ph = 297; // A4 mm
      const margin = 15;
      const contentW = pw - margin * 2;
      const cream = [245, 240, 232]; // warm crème background RGB
      const orange = [231, 64, 22]; // #E74016
      const darkText = [68, 66, 73]; // #444249
      const title = chartTitle || "Naamloze chart";
      const t = patternText;
      let pageNum = 0;

      const addPageBg = () => {
        doc.setFillColor(...cream);
        doc.rect(0, 0, pw, ph, "F");
        // Paper texture overlay
        try { doc.addImage(paperDataUrl, "JPEG", 0, 0, pw, ph, undefined, "NONE"); } catch (_) {}
      };

      const addFooter = (num) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...darkText);
        doc.text(`© ${new Date().getFullYear()} YarnZoo — www.yarnzoocrochet.com`, margin, ph - 8);
        doc.text(String(num), pw - margin, ph - 8, { align: "right" });
      };

      const addHeader = (text1, text2) => {
        doc.setFont("SketchSolid", "normal");
        doc.setFontSize(28);
        doc.setTextColor(...orange);
        doc.text(text1, margin, 22);
        if (text2) {
          doc.setFontSize(28);
          doc.setTextColor(180, 180, 170);
          const w1 = doc.getTextWidth(text1);
          doc.text(" " + text2, margin + w1, 22);
        }
      };

      // ---- PAGE 1: Cover ----
      addPageBg();
      // Orange accent line at top
      doc.setFillColor(...orange);
      doc.rect(0, 0, pw, 3, "F");
      // Logo image (centered, ~40mm wide)
      try { doc.addImage(logoDataUrl, "PNG", pw / 2 - 25, 12, 50, 18, undefined, "FAST"); } catch (_) {}
      // Subtitle "HAAKPATROON"
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...darkText);
      doc.text("HAAKPATROON", pw / 2, 38, { align: "center" });
      // Cover photo
      if (pdfCoverImage) {
        // Place photo centered, max width 130mm, below subtitle "HAAKPATROON"
        const imgMaxW = 130, imgMaxH = 160;
        const imgY = 44;
        try {
          // Detect format from data URL
          const imgFmt = pdfCoverImage.includes("image/png") ? "PNG" : "JPEG";
          const imgProps = doc.getImageProperties(pdfCoverImage);
          const aspect = imgProps.width / imgProps.height;
          // Fit within max bounds in mm
          let imgW = imgMaxW, imgH = imgW / aspect;
          if (imgH > imgMaxH) { imgH = imgMaxH; imgW = imgH * aspect; }
          doc.addImage(pdfCoverImage, imgFmt, (pw - imgW) / 2, imgY, imgW, imgH, undefined, "SLOW");
          // Pattern name below the photo
          const nameY = imgY + imgH + 10;
          doc.setFont("SketchSolid", "normal");
          doc.setFontSize(22);
          doc.setTextColor(...orange);
          const titleLines = doc.splitTextToSize(title.toUpperCase(), pw - 40);
          doc.text(titleLines, pw / 2, nameY, { align: "center" });
          // Subtitle below name
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(...darkText);
          doc.text(pdfSubtitle, pw / 2, nameY + titleLines.length * 8 + 4, { align: "center" });
        } catch (e) { console.error("Cover image error:", e); }
      } else {
        // Fallback: orange circle with title (no photo)
        doc.setFillColor(...orange);
        doc.circle(pw / 2, 75, 30, "F");
        doc.setFont("SketchSolid", "normal");
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        const titleLines = doc.splitTextToSize(title.toUpperCase(), 50);
        doc.text(titleLines, pw / 2, 72 - (titleLines.length - 1) * 4, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(pdfSubtitle, pw / 2, 82, { align: "center" });
        if (chart) {
          doc.setFontSize(9);
          doc.setTextColor(...darkText);
          doc.text(`${chart[0].length} x ${chart.length} steken`, pw / 2, 120, { align: "center" });
        }
      }
      // Footer on cover
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...darkText);
      doc.text("Inclusief online instructievideo's", pw / 2, ph - 20, { align: "center" });
      pageNum = 1;

      // ---- PAGE 2: Introduction ----
      doc.addPage();
      addPageBg();
      pageNum++;
      // Title
      doc.setFont("SketchSolid", "normal");
      doc.setFontSize(24);
      doc.setTextColor(...orange);
      const introTitle = title.toUpperCase();
      doc.text(introTitle, margin, 22);
      let y = 34;
      // Materials section
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...orange);
      doc.text("MATERIAAL", margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setTextColor(...darkText);
      if (pdfMaterialText.trim()) {
        const matLines = doc.splitTextToSize(pdfMaterialText, contentW);
        doc.text(matLines, margin, y);
        y += matLines.length * 4 + 4;
      } else {
        doc.text(`Kleur A: ${colA.name}`, margin + 4, y); y += 4;
        doc.text(`Kleur B: ${colB.name}`, margin + 4, y); y += 4;
        doc.text(`Haaknaald: 4 mm`, margin + 4, y); y += 8;
      }
      // Intro text
      if (pdfIntroText.trim()) {
        doc.setFontSize(9);
        doc.setTextColor(...darkText);
        const introLines = doc.splitTextToSize(pdfIntroText, contentW);
        doc.text(introLines, margin, y);
        y += introLines.length * 4 + 6;
      }
      // Symbol legend
      doc.setFontSize(11);
      doc.setTextColor(...orange);
      doc.text("UITLEG TELPATROON", margin, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(...darkText);
      // Draw legend boxes
      const legendItems = [
        { label: `${t.termSc} met ${colA.name}`, hex: colA.hex, filled: false },
        { label: `${t.termSc} met ${colB.name}`, hex: colB.hex, filled: true },
        { label: `${t.termDc} met ${colA.name}`, hex: colA.hex, filled: false, symbol: "T" },
        { label: `${t.termDc} met ${colB.name}`, hex: colB.hex, filled: true, symbol: "T" },
      ];
      for (const item of legendItems) {
        // Small colored box
        const [r, g, b] = item.filled
          ? [parseInt(item.hex.slice(1, 3), 16), parseInt(item.hex.slice(3, 5), 16), parseInt(item.hex.slice(5, 7), 16)]
          : [255, 255, 255];
        doc.setFillColor(r, g, b);
        doc.setDrawColor(100, 100, 100);
        doc.rect(margin + 2, y - 3, 5, 5, "FD");
        if (item.symbol) {
          doc.setFontSize(7);
          doc.setTextColor(item.filled ? 255 : 0, item.filled ? 255 : 0, item.filled ? 255 : 0);
          doc.text("T", margin + 4.5, y + 0.5, { align: "center" });
        }
        doc.setFontSize(9);
        doc.setTextColor(...darkText);
        doc.text(item.label, margin + 10, y);
        y += 7;
      }
      y += 4;
      // Abbreviations
      doc.setFontSize(11);
      doc.setTextColor(...orange);
      doc.text("UITLEG AFKORTING GESCHREVEN TEKST", margin, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(...darkText);
      const abbrevs = [
        `${t.termSc} — ${t.scInfo}`,
        `${t.termDc} — ${t.dcInfo}`,
        `KS — ${t.edgeInfo}`,
      ];
      for (const abbr of abbrevs) {
        const abbrLines = doc.splitTextToSize(abbr, contentW - 4);
        doc.text(abbrLines, margin + 4, y);
        y += abbrLines.length * 4 + 2;
      }
      y += 4;
      // Start pattern instruction
      doc.setFontSize(11);
      doc.setTextColor(...orange);
      doc.text("START PATROON", margin, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(...darkText);
      const startInstr = templateText(t.startLine1Template, { name: colA.name, chainCount: chart[0].length + 3 })
        + " " + templateText(t.startLine2Template, { stitchCount: chart[0].length + 2 });
      const startLines = doc.splitTextToSize(startInstr, contentW);
      doc.text(startLines, margin, y);
      addFooter(pageNum);

      // ---- PAGES 3+: Written Pattern ----
      const wpFontSize = 7;
      const wpLineHeight = 3.6;
      const wpHeaderHeight = 32;
      const wpFooterHeight = 16;
      const wpAvailHeight = ph - wpHeaderHeight - wpFooterHeight;
      const wpRowsPerPage = Math.floor(wpAvailHeight / wpLineHeight);

      for (let startIdx = 0; startIdx < patternRows.length; startIdx += wpRowsPerPage) {
        doc.addPage();
        addPageBg();
        pageNum++;
        addHeader("GESCHREVEN", "TEKST");
        // Green accent line under header
        doc.setFillColor(100, 140, 80);
        doc.rect(margin, 26, contentW, 0.5, "F");

        const endIdx = Math.min(startIdx + wpRowsPerPage, patternRows.length);
        let ry = wpHeaderHeight;

        for (let i = startIdx; i < endIdx; i++) {
          const rowNum = i + 1;
          const colorIdx = getRowColor(rowNum - 1);
          // Alternating row backgrounds
          if (i % 2 === 1) {
            doc.setFillColor(235, 235, 230);
            doc.rect(margin, ry - 2.5, contentW, wpLineHeight, "F");
          }
          // Color indicator bar on left
          const [cr, cg, cb] = colorIdx === 0
            ? [parseInt(colA.hex.slice(1, 3), 16), parseInt(colA.hex.slice(3, 5), 16), parseInt(colA.hex.slice(5, 7), 16)]
            : [parseInt(colB.hex.slice(1, 3), 16), parseInt(colB.hex.slice(3, 5), 16), parseInt(colB.hex.slice(5, 7), 16)];
          doc.setFillColor(cr, cg, cb);
          doc.rect(margin, ry - 2.5, 1.2, wpLineHeight, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(wpFontSize);
          doc.setTextColor(...darkText);
          // Truncate long rows to fit
          const maxChars = 160;
          const rowText = patternRows[i].length > maxChars ? patternRows[i].substring(0, maxChars) + "..." : patternRows[i];
          doc.text(rowText, margin + 3, ry);
          ry += wpLineHeight;
        }
        addFooter(pageNum);
      }

      // ---- CHART TOTAL PAGE ----
      doc.addPage();
      addPageBg();
      pageNum++;
      addHeader("TELPATROON", "TOTAAL");
      // Draw chart as vector graphics (sharp at any zoom level)
      // For the TOTAAL page with many columns, only show every 10th column number
      drawChartVectorInPDF({
        doc,
        chart,
        colA,
        colB,
        config: projConfig,
        startX: margin,
        startY: 32,
        availableWidth: contentW,
        availableHeight: ph - 32 - 16,
        showAllColumnNumbers: true, // TOTAAL page: show all column numbers (rotated 90°)
      });
      addFooter(pageNum);

      // ---- CHART SECTION PAGES ----
      if (chartSections.length > 1) {
        for (let si = 0; si < chartSections.length; si++) {
          const sec = chartSections[si];
          doc.addPage();
          addPageBg();
          pageNum++;
          const secName = (chartTitle || "PATROON").toUpperCase();
          addHeader(secName, "TELPATROON");
          // Section info
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(...darkText);
          doc.text(`${sec.label} — rij ${chart.length - sec.endRow + 1} t/m ${chart.length - sec.startRow}`, margin, 30);
          // Draw section chart as vector graphics
          drawChartVectorInPDF({
            doc,
            chart,
            colA,
            colB,
            config: projConfig,
            startX: margin,
            startY: 36,
            availableWidth: contentW,
            availableHeight: ph - 36 - 16,
            startRow: sec.startRow,
            endRow: sec.endRow,
            showAllColumnNumbers: true, // Section pages: try to show all numbers
          });
          addFooter(pageNum);
        }
      }

      // ---- FINISHING PAGE (Enveloprand) ----
      doc.addPage();
      addPageBg();
      pageNum++;
      addHeader("ENVELOP", "RAND");
      let fy = 34;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...darkText);
      if (pdfFinishText.trim()) {
        const finLines = doc.splitTextToSize(pdfFinishText, contentW);
        doc.text(finLines, margin, fy);
      } else {
        const defaultFinish = "Wanneer de deken helemaal is gehaakt, blijven er aan de zijkanten losse draadjes over. " +
          "Je kunt deze afknippen, maar dat is veel werk en het kan lastig zijn om een mooie, rechte rand te maken. " +
          "Een veiligere en mooiere alternatieve methode is de enveloprand.";
        const finLines = doc.splitTextToSize(defaultFinish, contentW);
        doc.text(finLines, margin, fy);
      }
      addFooter(pageNum);

      // ---- BACK PAGE ----
      doc.addPage();
      addPageBg();
      pageNum++;
      // Logo image centered
      try { doc.addImage(logoDataUrl, "PNG", pw / 2 - 30, ph / 2 - 15, 60, 22, undefined, "FAST"); } catch (_) {}
      // Contact info
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...darkText);
      doc.text("info@yarnzoocrochet.com", pw / 2, ph / 2 + 16, { align: "center" });
      doc.text("www.yarnzoocrochet.com", pw / 2, ph / 2 + 21, { align: "center" });
      // Copyright
      doc.setFontSize(7);
      doc.text(`Alle rechten voorbehouden. Dit patroon is alleen voor persoonlijk gebruik.`, pw / 2, ph - 20, { align: "center" });
      doc.text(`© ${new Date().getFullYear()} YarnZoo`, pw / 2, ph - 15, { align: "center" });

      // Save
      const fileName = `${title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")}_patroon.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Er ging iets mis bij het genereren van de PDF: " + err.message);
    } finally {
      setPdfGenerating(false);
    }
  };

  const printChart = () => {
    if (!chart || !printLayout) {
      alert("Er is geen chart om te printen.");
      return;
    }
    const rowCount = chart.length;

    const pages = [];
    for (let py = 0; py < printLayout.pagesY; py++) {
      for (let px = 0; px < printLayout.pagesX; px++) {
        pages.push(buildPrintPageImage({
          chart,
          colA,
          colB,
          config: projConfig,
          layout: printLayout,
          pageX: px,
          pageY: py,
        }));
      }
    }

    const win = window.open("", "_blank");
    if (!win) {
      alert("Popup geblokkeerd. Sta popups toe om print preview te openen.");
      return;
    }

    const sizeText = `${printPaper} ${printOrientation === "portrait" ? "staand" : "liggend"}`;
    const pageCssSize = `${printPaper} ${printOrientation === "portrait" ? "portrait" : "landscape"}`;
    const doc = win.document;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8" /><title>Print chart - ${chartTitle || "YarnZoo"}</title></head><body><div id="print-root"></div></body></html>`);
    doc.close();

    const style = doc.createElement("style");
    style.textContent = `
      @page { size: ${pageCssSize}; margin: ${Math.max(3, Number(printMarginMm) || 0)}mm; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 12px; font-family: Arial, sans-serif; background: #f6f6f6; color: #222; }
      .toolbar { position: sticky; top: 0; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; z-index: 1; }
      .meta { font-size: 12px; color: #555; }
      .print-btn { border: 1px solid #222; border-radius: 6px; background: #fff; padding: 8px 12px; cursor: pointer; font-weight: 700; }
      .page { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 8px; margin: 0 auto 12px; display: inline-block; page-break-after: always; }
      .page:last-child { page-break-after: auto; }
      .label { font-size: 11px; margin-bottom: 6px; color: #666; }
      img { display: block; max-width: 100%; height: auto; }
      @media print {
        body { background: #fff; padding: 0; }
        .toolbar { display: none; }
        .page { border: none; border-radius: 0; padding: 0; margin: 0; display: block; }
        .label { display: none; }
      }
    `;
    doc.head.appendChild(style);

    const root = doc.getElementById("print-root");
    if (!root) return;

    const toolbar = doc.createElement("div");
    toolbar.className = "toolbar";

    const meta = doc.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<strong>${chartTitle || "Naamloze chart"}</strong><br/>${sizeText} · ${pages.length} pagina${pages.length === 1 ? "" : "'s"} · cel ${printLayout.cellMm.toFixed(2)} mm`;

    const printBtn = doc.createElement("button");
    printBtn.className = "print-btn";
    printBtn.textContent = "Print / Opslaan als PDF";
    printBtn.onclick = () => win.print();

    toolbar.appendChild(meta);
    toolbar.appendChild(printBtn);
    root.appendChild(toolbar);

    for (let idx = 0; idx < pages.length; idx++) {
      const p = pages[idx];
      const section = doc.createElement("section");
      section.className = "page";

      const label = doc.createElement("div");
      label.className = "label";
      label.textContent = `Pagina ${idx + 1} · kolommen ${p.startCol + 1}-${p.endCol} · rijen ${rowCount - p.endRow + 1}-${rowCount - p.startRow}`;

      const img = doc.createElement("img");
      img.alt = `Chart pagina ${idx + 1}`;
      img.src = p.dataUrl;

      section.appendChild(label);
      section.appendChild(img);
      root.appendChild(section);
    }

    win.focus();
  };

  return (
    <div style={{ minHeight: "100vh", background: B.white, fontFamily: F.body, color: B.dark }}>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <header style={{ background: B.white, position: "sticky", top: 0, zIndex: 100, borderBottom: `1px solid ${B.border}` }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "10px 24px", display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: B.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: B.white, fontWeight: 700 }}>YZ</div>
            <div>
              <span style={{ color: B.orange, fontWeight: 700, fontSize: "20px", fontFamily: F.heading, lineHeight: 1 }}>YarnZoo</span>
              <span style={{ color: "#7A7780", fontSize: "9px", letterSpacing: "1.2px", textTransform: "uppercase", marginLeft: "6px" }}>Mosaic Studio</span>
            </div>
          </div>

          {/* Workflow stepper (desktop) */}
          {!isMobile && (
            <nav style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1, justifyContent: "center" }}>
              {sidebarStepItems.map((item, i) => (
                <React.Fragment key={item.id}>
                  {i > 0 && <span style={{ color: B.beige, fontSize: "14px", margin: "0 2px" }}>—</span>}
                  <button
                    onClick={() => goToStep(item.id)}
                    disabled={!item.enabled}
                    style={{
                      background: step === item.id ? B.cream : "transparent",
                      border: `1.5px solid ${step === item.id ? B.orange : "transparent"}`,
                      borderRadius: "20px", padding: "6px 14px", fontSize: "12px", fontWeight: 600,
                      cursor: item.enabled ? "pointer" : "not-allowed",
                      color: step === item.id ? B.orange : item.enabled ? B.dark : "#aaa",
                      opacity: item.enabled ? 1 : 0.5, whiteSpace: "nowrap", fontFamily: F.body,
                    }}
                  >{item.label}</button>
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {chart && !isMobile && (
              <>
                <button onClick={undo} disabled={!canUndo} style={{ ...btnHead, opacity: canUndo ? 1 : 0.35 }} title="Ongedaan maken (Cmd+Z)">↩</button>
                <button onClick={redo} disabled={!canRedo} style={{ ...btnHead, opacity: canRedo ? 1 : 0.35 }} title="Opnieuw (Cmd+Shift+Z)">↪</button>
              </>
            )}
            {!isMobile && (
              <div style={{ position: "relative" }}>
                <button onClick={(e) => { e.stopPropagation(); toggleMenuPanel("bestand"); }} style={btnHead}>Bestand ▾</button>
                {openMenu === "bestand" && (
                  <div style={dropdownWrap} onClick={e => e.stopPropagation()}>
                    <button style={dropdownItem} onClick={() => { newChart(); setOpenMenu(""); }}>Nieuw chart</button>
                    <button style={dropdownItem} onClick={() => { saveCurrentChart(); setOpenMenu(""); }}>Opslaan</button>
                    <button style={dropdownItem} onClick={() => toggleMenuPanel("settings")}>Chart instellingen</button>
                    <button style={dropdownItem} onClick={() => toggleMenuPanel("library")}>Bibliotheek</button>
                    <button style={dropdownItem} onClick={() => toggleMenuPanel("folders")}>Mappen beheren</button>
                    <div style={{ borderTop: `1px solid ${B.border}`, margin: "4px 0" }} />
                    <button style={dropdownItem} onClick={() => toggleMenuPanel("palette")}>Garenpalet</button>
                    <button style={dropdownItem} onClick={() => toggleMenuPanel("translations")}>Vertaaltabel</button>
                    {hasSupabaseConfig && (
                      <>
                        <div style={{ borderTop: `1px solid ${B.border}`, margin: "4px 0" }} />
                        <button style={dropdownItem} onClick={() => { if (user) { signOutUser(); } else { toggleMenuPanel("auth"); } setOpenMenu(""); }}>{user ? "Uitloggen" : "Inloggen"}</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {chart && !isMobile && <button onClick={exportText} style={{ ...btnPri, padding: "8px 16px", fontSize: "12px" }}>Export</button>}
            {isMobile && <button style={btnHead} onClick={() => setSidebarOpen(true)}>Menu</button>}
          </div>
        </div>
      </header>

      {isMobile && sidebarOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.35)" }}
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            style={{ width: "290px", maxWidth: "88vw", height: "100%", background: B.white, borderRight: `1px solid ${B.border}`, padding: "16px" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ fontSize: "18px", color: B.orange, fontFamily: F.heading }}>Menu</div>
              <button style={btnHead} onClick={() => setSidebarOpen(false)}>Sluiten</button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>
          <div style={{ minWidth: 0 }}>

        {openMenu === "settings" && (
          <div style={{ background: B.white, border: `1px solid ${B.beige}`, borderRadius: "6px", padding: "12px", marginBottom: "14px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: B.orange, marginBottom: "8px" }}>Chart instellingen</div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
              <span style={lbl}>Titel:</span>
              <input value={chartTitle} onChange={e => setChartTitle(e.target.value)} style={{ ...inp, width: "180px", textAlign: "left" }} />
              <span style={lbl}>Map:</span>
              <select value={chartFolderId} onChange={e => setChartFolderId(e.target.value)} style={{ ...inp, width: "170px" }}>
                {selectableFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <button style={btnSm} onClick={saveCurrentChart}>Opslaan</button>
              <button style={btnSm} onClick={() => setOpenMenu("")}>Sluiten</button>
            </div>
          </div>
        )}

        {openMenu === "auth" && hasSupabaseConfig && !user && (
          <div style={{ background: B.white, border: `1px solid ${B.beige}`, borderRadius: "6px", padding: "12px", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", gap: "8px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: B.orange }}>Account</div>
              <button style={btnSm} onClick={() => setOpenMenu("")}>Sluiten</button>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <button
                onClick={() => setAuthMode("signin")}
                style={{
                  ...btnSm,
                  borderColor: authMode === "signin" ? B.orange : B.border,
                  color: authMode === "signin" ? B.orange : B.dark,
                  background: authMode === "signin" ? B.cream : B.white,
                }}
              >
                Inloggen
              </button>
              <button
                onClick={() => setAuthMode("signup")}
                style={{
                  ...btnSm,
                  borderColor: authMode === "signup" ? B.orange : B.border,
                  color: authMode === "signup" ? B.orange : B.dark,
                  background: authMode === "signup" ? B.cream : B.white,
                }}
              >
                Registreren
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", color: "#666" }}>
                E-mailadres
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  placeholder="naam@voorbeeld.nl"
                  style={{ ...inp, width: "100%", textAlign: "left", marginTop: "4px" }}
                />
              </label>
              <label style={{ fontSize: "12px", color: "#666" }}>
                Wachtwoord
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  placeholder="Minimaal 6 tekens"
                  style={{ ...inp, width: "100%", textAlign: "left", marginTop: "4px" }}
                />
              </label>
              <button
                onClick={authMode === "signin" ? signInWithEmailPassword : signUpWithEmailPassword}
                disabled={authBusy}
                style={{
                  ...btnPri,
                  width: "fit-content",
                  opacity: authBusy ? 0.6 : 1,
                  cursor: authBusy ? "not-allowed" : "pointer",
                }}
              >
                {authBusy ? "Even geduld..." : authMode === "signin" ? "Inloggen met e-mail" : "Account aanmaken"}
              </button>
              <div style={{ fontSize: "11px", color: "#666" }}>
                Na inloggen worden je charts en vertalingen direct aan cloudfuncties gekoppeld.
              </div>
            </div>
          </div>
        )}

        {openMenu === "folders" && (
          <div style={{ background: B.white, border: `1px solid ${B.beige}`, borderRadius: "6px", padding: "12px", marginBottom: "14px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: B.orange, marginBottom: "8px" }}>Mappen beheren</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
              <input value={folderDraftName} onChange={e => setFolderDraftName(e.target.value)} placeholder="Nieuwe mapnaam" style={{ ...inp, width: "170px", textAlign: "left" }} />
              <button style={btnSm} onClick={addFolder}>Map toevoegen</button>
              <button style={btnSm} onClick={() => setOpenMenu("")}>Sluiten</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {folders.map(folder => (
                <div key={folder.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#666" }}>
                  <strong style={{ minWidth: "170px", color: B.dark }}>{folder.name}</strong>
                  {folder.system ? (
                    <span style={{ fontSize: "11px", color: "#999" }}>Systeemmap</span>
                  ) : (
                    <>
                      <button style={btnSm} onClick={() => renameFolder(folder.id)}>Hernoemen</button>
                      <button style={{ ...btnSm, borderColor: "#d55", color: "#a11" }} onClick={() => removeFolder(folder.id)}>Verwijderen</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {openMenu === "palette" && (
          <div style={{ background: B.white, border: `1px solid ${B.beige}`, borderRadius: "6px", padding: "12px", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: B.orange }}>Garenpalet</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button style={btnSm} onClick={resetCustomPalette}>Reset custom kleuren</button>
                <button style={btnSm} onClick={() => setOpenMenu("")}>Sluiten</button>
              </div>
            </div>
            <div style={{ marginBottom: "10px", fontSize: "12px", color: "#666" }}>
              Basiskleuren zijn vergrendeld. Alleen aangepaste kleuren kunnen hernoemd of verwijderd worden.
            </div>
            <div style={{ overflow: "auto", border: `1px solid ${B.border}`, borderRadius: "6px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: B.cream, color: B.dark }}>
                    <th style={{ textAlign: "left", padding: "8px", borderBottom: `1px solid ${B.border}`, minWidth: "44px" }}>Kleur</th>
                    <th style={{ textAlign: "left", padding: "8px", borderBottom: `1px solid ${B.border}`, minWidth: "160px" }}>Naam</th>
                    <th style={{ textAlign: "left", padding: "8px", borderBottom: `1px solid ${B.border}`, minWidth: "95px" }}>Hex</th>
                    <th style={{ textAlign: "left", padding: "8px", borderBottom: `1px solid ${B.border}`, minWidth: "88px" }}>Type</th>
                    <th style={{ textAlign: "left", padding: "8px", borderBottom: `1px solid ${B.border}`, minWidth: "160px" }}>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {yarnPalette.map((entry, idx) => (
                    <tr key={`${entry.name}-${entry.hex}-${idx}`}>
                      <td style={{ padding: "8px", borderBottom: `1px solid ${B.border}` }}>
                        <span style={{ display: "inline-block", width: "18px", height: "18px", borderRadius: "4px", border: "1px solid #bbb", background: entry.hex }} />
                      </td>
                      <td style={{ padding: "8px", borderBottom: `1px solid ${B.border}`, color: B.dark, fontWeight: 700 }}>{entry.name}</td>
                      <td style={{ padding: "8px", borderBottom: `1px solid ${B.border}`, color: "#555", fontFamily: F.mono }}>{entry.hex}</td>
                      <td style={{ padding: "8px", borderBottom: `1px solid ${B.border}`, color: entry.locked ? B.orange : "#666" }}>
                        {entry.locked ? "Basis" : "Custom"}
                      </td>
                      <td style={{ padding: "8px", borderBottom: `1px solid ${B.border}` }}>
                        {entry.locked ? (
                          <span style={{ fontSize: "11px", color: "#999" }}>Vergrendeld</span>
                        ) : (
                          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                            <button style={btnSm} onClick={() => renamePaletteEntry(idx)}>Hernoemen</button>
                            <button style={{ ...btnSm, borderColor: "#d55", color: "#a11" }} onClick={() => removePaletteEntry(idx)}>Verwijderen</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {openMenu === "translations" && (
          <div style={{ background: B.white, border: `1px solid ${B.beige}`, borderRadius: "6px", padding: "12px", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: B.orange }}>Vertaaltabel geschreven patroon</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={lbl}>Actieve taal:</span>
                <select value={patternLanguage} onChange={e => setPatternLanguage(e.target.value)} style={{ ...inp, width: "132px", textAlign: "left" }}>
                  {languageEntries.map(([key, v]) => (
                    <option key={key} value={key}>{v.label}</option>
                  ))}
                </select>
                <button style={{ ...btnSm, borderColor: translationsLocked ? B.orange : "#d55", color: translationsLocked ? B.orange : "#a11" }} onClick={toggleTranslationsLock}>
                  {translationsLocked ? "Ontgrendelen" : "Vergrendelen"}
                </button>
                <button style={btnSm} onClick={resetTranslationsToDefault}>Reset standaard</button>
                <button style={btnSm} onClick={() => setOpenMenu("")}>Sluiten</button>
              </div>
            </div>
            <div style={{ marginBottom: "10px", fontSize: "12px", color: "#666" }}>
              Opslag: <strong>{translationCloudLabel}</strong>
              {translationCloudStatus === "setup_needed" && " (voer de SQL-update uit voor globale vertaaltabellen)"}
            </div>
            {!translationsLocked && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "10px", padding: "8px", background: B.cream, border: `1px solid ${B.border}`, borderRadius: "6px" }}>
                <span style={{ ...lbl, color: B.orange }}>Bewerkmodus actief</span>
                <span style={{ fontSize: "12px", color: "#666" }}>Tabel is van het slot. Pas aan en vergrendel weer.</span>
                <input value={newLanguageCode} onChange={e => setNewLanguageCode(e.target.value)} placeholder="Taalcode (bv. fr)" style={{ ...inp, width: "130px", textAlign: "left" }} />
                <input value={newLanguageLabel} onChange={e => setNewLanguageLabel(e.target.value)} placeholder="Taalnaam" style={{ ...inp, width: "140px", textAlign: "left" }} />
                <button style={btnSm} onClick={addTranslationLanguage}>Taal toevoegen</button>
              </div>
            )}
            <div style={{ overflow: "auto", border: `1px solid ${B.border}`, borderRadius: "6px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: B.cream, color: B.dark }}>
                    <th style={{ textAlign: "left", padding: "8px", borderBottom: `1px solid ${B.border}`, minWidth: "140px" }}>Term</th>
                    {languageEntries.map(([lang, v]) => (
                      <th key={lang} style={{ textAlign: "left", padding: "8px", borderBottom: `1px solid ${B.border}`, minWidth: "210px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                          <span>{v.label} ({lang})</span>
                          {!translationsLocked && lang !== "nl" && (
                            <button style={{ ...btnSm, padding: "2px 8px", fontSize: "11px", borderColor: "#d55", color: "#a11" }} onClick={() => removeTranslationLanguage(lang)}>x</button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TRANSLATION_FIELDS.map((field) => (
                    <tr key={field.key}>
                      <td style={{ padding: "8px", borderBottom: `1px solid ${B.border}`, color: B.dark, fontWeight: 700 }}>{field.term}</td>
                      {languageEntries.map(([lang, val]) => (
                        <td key={`${field.key}-${lang}`} style={{ padding: "8px", borderBottom: `1px solid ${B.border}`, color: "#555" }}>
                          {translationsLocked ? (
                            val[field.key]
                          ) : (
                            <input
                              value={val[field.key] || ""}
                              onChange={e => updateTranslationValue(lang, field.key, e.target.value)}
                              style={{ ...inp, width: "100%", textAlign: "left", fontSize: "11px" }}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {openMenu === "library" && (
          <div style={{ background: B.white, border: `1px solid ${B.beige}`, borderRadius: "6px", padding: "12px", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: B.orange }}>Bibliotheek</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={lbl}>Filter:</span>
                <select value={libraryFilter} onChange={e => setLibraryFilter(e.target.value)} style={{ ...inp, width: "180px" }}>
                  <option value="all">Actieve charts</option>
                  {selectableFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  <option value="deleted">Verwijderde charts</option>
                </select>
                <button style={btnSm} onClick={() => setOpenMenu("")}>Sluiten</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "260px", overflow: "auto" }}>
              {filteredCharts.length === 0 && <div style={{ fontSize: "12px", color: "#999" }}>Geen charts gevonden.</div>}
              {filteredCharts.map(saved => {
                const restorable = withinRestoreWindow(saved);
                const deletedLabel = saved.isDeleted ? (restorable ? "verwijderd (herstelbaar)" : "verwijderd (termijn verlopen)") : "actief";
                const isEditing = editingLibraryId === saved.id;
                return (
                  <div key={saved.id} style={{ border: `1px solid ${B.beige}`, borderRadius: "6px", padding: "8px", display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "12px", color: "#555", flex: 1 }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                          <input
                            type="text"
                            value={editingLibraryTitle}
                            onChange={(e) => setEditingLibraryTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renameLocalChart(saved.id, editingLibraryTitle);
                              if (e.key === "Escape") { setEditingLibraryId(null); setEditingLibraryTitle(""); }
                            }}
                            style={{ ...inp, flex: 1, fontWeight: 600 }}
                            autoFocus
                          />
                          <button style={{ ...btnSm, padding: "4px 8px" }} onClick={() => renameLocalChart(saved.id, editingLibraryTitle)}>✓</button>
                          <button style={{ ...btnSm, padding: "4px 8px", background: "transparent", border: `1px solid ${B.beige}` }} onClick={() => { setEditingLibraryId(null); setEditingLibraryTitle(""); }}>✕</button>
                        </div>
                      ) : (
                        <>
                          <strong style={{ color: B.dark }}>{saved.title || "Naamloze chart"}</strong><br />
                          {saved.gridW} × {saved.gridH} patroon · map: {findFolderName(saved.folderId)} · {deletedLabel}
                        </>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      {!isEditing && (
                        <button style={{ ...btnSm, padding: "4px 8px", background: "transparent", border: `1px solid ${B.beige}` }} onClick={() => { setEditingLibraryId(saved.id); setEditingLibraryTitle(saved.title || ""); }} title="Hernoemen">✏️</button>
                      )}
                      <button style={btnSm} onClick={() => openSavedChart(saved)}>
                        {saved.isDeleted ? "Herstel + open" : "Open"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === "upload" && (
          <div style={{ textAlign: "center", paddingTop: "60px" }}>
            <h1 style={{ fontSize: "34px", color: B.orange, marginBottom: "8px", fontWeight: 700, fontFamily: F.heading }}>Upload je ontwerp</h1>
            <p style={{ color: "#888", fontSize: "14px", maxWidth: "520px", margin: "0 auto 32px", lineHeight: 1.6 }}>
              Upload een afbeelding van je dier of ontwerp. Het wordt automatisch omgezet naar een overlay mozaiek haakpatroon. Werkt het beste met tweekleurige afbeeldingen met hoog contrast.
            </p>
            <label style={{
              display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "16px",
              padding: "48px 64px", border: `3px dashed ${B.orange}40`, borderRadius: "16px",
              background: B.white, cursor: "pointer", transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = B.orange; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${B.orange}40`; }}
            >
              <div style={{ fontSize: "12px", letterSpacing: "1.2px", textTransform: "uppercase", color: B.orange, fontWeight: 700 }}>Afbeelding uploaden</div>
              <div style={{ fontSize: "16px", fontWeight: 600, color: B.dark }}>Klik om een afbeelding te kiezen</div>
              <div style={{ fontSize: "12px", color: "#aaa" }}>JPG, PNG — bij voorkeur 2 kleuren / hoog contrast</div>
              <input type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
            </label>
          </div>
        )}

        {step === "adjust" && (
          <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: "20px", alignItems: "start" }}>

            {/* LEFT SIDEBAR — controls (desktop) */}
            {!isMobile && (
              <aside style={{ position: "sticky", top: "64px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <Panel title="Raster afmetingen">
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={lbl}>Breed:</span>
                    <input type="number" min={20} max={300} value={gridW} onChange={e => {
                      setSyncCalculatorToGrid(false);
                      const v = parseInt(e.target.value) || 20; setGridW(v);
                      if (imgEl) setGridH(Math.round(v * (imgEl.height / imgEl.width)));
                    }} style={inp} />
                    <span style={lbl}>Hoog:</span>
                    <input type="number" min={20} max={400} value={gridH} onChange={e => { setSyncCalculatorToGrid(false); setGridH(parseInt(e.target.value) || 20); }} style={inp} />
                  </div>
                </Panel>

                <Panel title="Drempel (licht / donker)">
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "11px" }}>Meer stokjes</span>
                    <input type="range" min={30} max={230} value={threshold} onChange={e => setThreshold(parseInt(e.target.value))} style={{ width: "120px" }} />
                    <span style={{ fontSize: "11px" }}>Minder stokjes</span>
                    <span style={{ fontSize: "11px", color: "#888" }}>{threshold}</span>
                  </div>
                </Panel>

                <Panel title="Kleuren">
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <ColorPick
                      label="Kleur A (oneven rijen)"
                      color={colA}
                      set={setColA}
                      palette={yarnPalette}
                      onPickFromPalette={(entry) => applyPaletteColor(entry, setColA, DEFAULT_COLOR_A)}
                      onSaveToPalette={() => saveColorToPalette(colA)}
                    />
                    <ColorPick
                      label="Kleur B (even rijen)"
                      color={colB}
                      set={setColB}
                      palette={yarnPalette}
                      onPickFromPalette={(entry) => applyPaletteColor(entry, setColB, DEFAULT_COLOR_B)}
                      onSaveToPalette={() => saveColorToPalette(colB)}
                    />
                    <button onClick={() => { const tmp = colA; setColA(colB); setColB(tmp); }} style={{ ...btnSm, marginBottom: "2px" }}>⇄</button>
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "11px", color: "#777" }}>
                    Basispalet staat vast. Nieuwe kleuren voeg je toe met <strong>In palet</strong>. Beheer via Instellingen → Garenpalet.
                  </div>
                </Panel>

                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <button onClick={() => setStep("upload")} style={{ ...btnSec, flex: 1 }}>← Terug</button>
                  <button onClick={confirmGrid} style={{ ...btnPri, flex: 1 }}>Bevestig →</button>
                </div>
              </aside>
            )}

            {/* CENTER — previews + calculator */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "28px", color: B.orange, marginBottom: "0", fontFamily: F.heading, fontWeight: 700 }}>Pas de conversie aan</h2>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "16px" }}>
                <div>
                  <div style={panelLabel}>Originele afbeelding</div>
                  <div style={{ background: B.white, borderRadius: "6px", padding: "12px", border: `1px solid ${B.beige}`, textAlign: "center" }}>
                    <img src={origImage} alt="Original" style={{ maxWidth: "100%", maxHeight: "400px", borderRadius: "6px" }} />
                  </div>
                </div>
                <div>
                  <div style={panelLabel}>Telpatroon preview ({projConfig.showEdges ? gridW + 2 : gridW} × {gridH})</div>
                  <div style={{ background: B.white, borderRadius: "6px", padding: "12px", border: `1px solid ${B.beige}`, textAlign: "center" }}>
                    <canvas ref={previewRef} style={{ maxWidth: "100%", imageRendering: "pixelated", borderRadius: "6px" }} />
                  </div>
                </div>
              </div>

              <Panel title="Chart Size Calculator">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={lbl}>Eenheid:</span>
                    <select value={calcUnit} onChange={e => setCalcUnit(e.target.value)} style={{ ...inp, width: "80px" }}>
                      <option value="cm">cm</option>
                      <option value="inch">inch</option>
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#666", marginLeft: "6px" }}>
                      <input type="checkbox" checked={calcIncludesEdges} onChange={e => setCalcIncludesEdges(e.target.checked)} />
                      Kolommen incl. kantsteken
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#666", marginLeft: "6px" }}>
                      <input type="checkbox" checked={syncCalculatorToGrid} onChange={e => setSyncCalculatorToGrid(e.target.checked)} />
                      Auto-sync naar raster
                    </label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: B.orange, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                        Sample swatch
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
                        <span style={lbl}>Maat:</span>
                        <input type="number" min="0" step="0.1" value={swatchWidth} onChange={e => { setSyncCalculatorToGrid(true); setSwatchWidth(Math.max(0, parseFloat(e.target.value) || 0)); }} style={inp} />
                        <span style={{ fontSize: "11px", color: "#777" }}>×</span>
                        <input type="number" min="0" step="0.1" value={swatchHeight} onChange={e => { setSyncCalculatorToGrid(true); setSwatchHeight(Math.max(0, parseFloat(e.target.value) || 0)); }} style={inp} />
                        <span style={{ fontSize: "11px", color: "#777" }}>{calcUnit}</span>
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={lbl}>Steken:</span>
                        <input type="number" min="0" step="1" value={swatchStitches} onChange={e => { setSyncCalculatorToGrid(true); setSwatchStitches(Math.max(0, parseInt(e.target.value) || 0)); }} style={inp} />
                        <span style={{ fontSize: "11px", color: "#777" }}>×</span>
                        <input type="number" min="0" step="1" value={swatchRows} onChange={e => { setSyncCalculatorToGrid(true); setSwatchRows(Math.max(0, parseInt(e.target.value) || 0)); }} style={inp} />
                        <span style={{ fontSize: "11px", color: "#777" }}>rijen</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: B.orange, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                        Gewenste eindmaat
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={lbl}>Maat:</span>
                        <input type="number" min="0" step="0.1" value={desiredWidth} onChange={e => { setSyncCalculatorToGrid(true); setDesiredWidth(Math.max(0, parseFloat(e.target.value) || 0)); }} style={inp} />
                        <span style={{ fontSize: "11px", color: "#777" }}>×</span>
                        <input type="number" min="0" step="0.1" value={desiredHeight} onChange={e => { setSyncCalculatorToGrid(true); setDesiredHeight(Math.max(0, parseFloat(e.target.value) || 0)); }} style={inp} />
                        <span style={{ fontSize: "11px", color: "#777" }}>{calcUnit}</span>
                      </div>
                    </div>
                  </div>

                  {calculatorResult ? (
                    <div style={{ fontSize: "11px", color: "#555", lineHeight: 1.5, background: B.cream, border: `1px solid ${B.beige}`, borderRadius: "6px", padding: "8px 10px" }}>
                      Gauge: {calculatorResult.gaugeW.toFixed(2)} × {calculatorResult.gaugeH.toFixed(2)} steken per {calcUnit}<br />
                      Calculator uitkomst: <strong>{calculatorResult.calculatedColumns}</strong> kolommen × <strong>{calculatorResult.calculatedRows}</strong> rijen = <strong>{calculatorResult.calculatorTotalStitches.toLocaleString("nl-NL")}</strong> steken<br />
                      Teltekening toepassing: <strong>{calculatorResult.targetTotalColumns}</strong> kolommen × <strong>{calculatorResult.calculatedRows}</strong> rijen = <strong>{calculatorResult.appliedTotalStitches.toLocaleString("nl-NL")}</strong> steken
                      {projConfig.showEdges && <><br />({calculatorResult.targetPatternColumns} patroon + 2 kantsteken)</>}
                      <br />
                      Huidig raster ({calculatorResult.currentTotalColumns} × {gridH}) is ca. {calculatorResult.currentWidth.toFixed(1)} × {calculatorResult.currentHeight.toFixed(1)} {calcUnit}
                    </div>
                  ) : (
                    <div style={{ fontSize: "11px", color: "#888", background: B.cream, border: `1px solid ${B.beige}`, borderRadius: "6px", padding: "8px 10px" }}>
                      Vul alle calculatorvelden met waarden groter dan 0.
                    </div>
                  )}

                  <button
                    onClick={applyCalculatedSize}
                    disabled={!calculatorResult}
                    style={{
                      ...btnSm,
                      fontWeight: 700,
                      color: calculatorResult ? B.orange : "#999",
                      borderColor: calculatorResult ? B.orange : B.beige,
                      background: calculatorResult ? B.cream : "#F8F8F8",
                      cursor: calculatorResult ? "pointer" : "not-allowed",
                    }}
                  >
                    Gebruik berekende afmetingen ({calculatorResult ? `${calculatorResult.targetTotalColumns} × ${calculatorResult.calculatedRows}` : "-"})
                  </button>
                </div>
              </Panel>

              {/* Mobile: controls inline below previews */}
              {isMobile && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <Panel title="Raster afmetingen">
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={lbl}>Breed:</span>
                      <input type="number" min={20} max={300} value={gridW} onChange={e => {
                        setSyncCalculatorToGrid(false);
                        const v = parseInt(e.target.value) || 20; setGridW(v);
                        if (imgEl) setGridH(Math.round(v * (imgEl.height / imgEl.width)));
                      }} style={inp} />
                      <span style={lbl}>Hoog:</span>
                      <input type="number" min={20} max={400} value={gridH} onChange={e => { setSyncCalculatorToGrid(false); setGridH(parseInt(e.target.value) || 20); }} style={inp} />
                    </div>
                  </Panel>

                  <Panel title="Drempel (licht / donker)">
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "11px" }}>Meer stokjes</span>
                      <input type="range" min={30} max={230} value={threshold} onChange={e => setThreshold(parseInt(e.target.value))} style={{ width: "120px" }} />
                      <span style={{ fontSize: "11px" }}>Minder stokjes</span>
                      <span style={{ fontSize: "11px", color: "#888" }}>{threshold}</span>
                    </div>
                  </Panel>

                  <Panel title="Kleuren">
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
                      <ColorPick
                        label="Kleur A (oneven rijen)"
                        color={colA}
                        set={setColA}
                        palette={yarnPalette}
                        onPickFromPalette={(entry) => applyPaletteColor(entry, setColA, DEFAULT_COLOR_A)}
                        onSaveToPalette={() => saveColorToPalette(colA)}
                      />
                      <ColorPick
                        label="Kleur B (even rijen)"
                        color={colB}
                        set={setColB}
                        palette={yarnPalette}
                        onPickFromPalette={(entry) => applyPaletteColor(entry, setColB, DEFAULT_COLOR_B)}
                        onSaveToPalette={() => saveColorToPalette(colB)}
                      />
                      <button onClick={() => { const tmp = colA; setColA(colB); setColB(tmp); }} style={{ ...btnSm, marginBottom: "2px" }}>⇄</button>
                    </div>
                    <div style={{ marginTop: "6px", fontSize: "11px", color: "#777" }}>
                      Basispalet staat vast. Nieuwe kleuren voeg je toe met <strong>In palet</strong>. Beheer via Instellingen → Garenpalet.
                    </div>
                  </Panel>

                  <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                    <button onClick={() => setStep("upload")} style={btnSec}>← Terug</button>
                    <button onClick={confirmGrid} style={btnPri}>Bevestig en ga bewerken →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "edit" && chart && (
          <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "220px minmax(0,1fr) 260px", gap: "16px", alignItems: "start" }}>

            {/* LEFT SIDEBAR (desktop) */}
            {!isMobile && (
              <aside style={{ position: "sticky", top: "64px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <Panel title="Gereedschap">
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {[
                      { id: "colorA", label: `Stokje ${colA.name || "A"}`, desc: "Teken met kleur A", color: colA.hex },
                      { id: "colorB", label: `Stokje ${colB.name || "B"}`, desc: "Teken met kleur B", color: colB.hex },
                      { id: "symbol", label: "Stokje", desc: "Plaats stokje (elke rij)" },
                      { id: "erase", label: "Wissen", desc: "Verwijder een stokje" },
                      { id: "toggle", label: "Wissel", desc: "Wissel stokje/leeg" },
                    ].map(t => (
                      <button key={t.id} onClick={() => setTool(t.id)} style={{
                        padding: "10px 12px", borderRadius: "8px", border: `2px solid ${tool === t.id ? B.orange : B.border}`,
                        background: tool === t.id ? B.cream : B.white, cursor: "pointer", textAlign: "left",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {t.color && <span style={{ width: "14px", height: "14px", borderRadius: "3px", background: t.color, border: "1px solid rgba(0,0,0,0.2)", flexShrink: 0 }} />}
                          <span style={{ fontWeight: 700, fontSize: "13px", color: tool === t.id ? B.orange : B.dark }}>{t.label}</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </Panel>
                <Panel title="Garen kleuren">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "24px", height: "24px", borderRadius: "4px", background: colA.hex, border: "1px solid #ccc", flexShrink: 0 }} />
                      <div><div style={{ fontSize: "12px", fontWeight: 600 }}>Kleur A</div><div style={{ fontSize: "11px", color: "#888" }}>{colA.name}</div></div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "24px", height: "24px", borderRadius: "4px", background: colB.hex, border: "1px solid #ccc", flexShrink: 0 }} />
                      <div><div style={{ fontSize: "12px", fontWeight: 600 }}>Kleur B</div><div style={{ fontSize: "11px", color: "#888" }}>{colB.name}</div></div>
                    </div>
                  </div>
                </Panel>
                <Panel title="Transformaties">
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <button onClick={() => { pushHistory(chart); applyValidatedChart(chart.map(r => r.map(c => !c)), { notify: true }); }} style={btnSm}>◐ Omkeren</button>
                    <button onClick={() => { pushHistory(chart); applyValidatedChart(chart.map(r => [...r].reverse()), { notify: true }); }} style={btnSm}>↔ Spiegel H</button>
                    <button onClick={() => { pushHistory(chart); applyValidatedChart([...chart].reverse(), { notify: true }); }} style={btnSm}>↕ Spiegel V</button>
                    <button onClick={() => applyValidatedChart(chart, { notify: true, successMessage: "Controle OK: overlay-regels kloppen." })} style={btnSm}>✓ Check</button>
                  </div>
                </Panel>
                <Panel title="Zoom">
                  <input type="range" min={2} max={18} value={cellSize} onChange={e => setCellSize(parseInt(e.target.value))} style={{ width: "100%" }} />
                </Panel>
              </aside>
            )}

            {/* CENTER: Canvas */}
            <div>
              {fixCount > 0 && (
                <div style={{ background: B.cream, border: `1px solid ${B.orange}`, borderRadius: "6px", padding: "10px 16px", marginBottom: "12px", fontSize: "13px" }}>
                  Let op: <strong>{fixCount}</strong> stokjes zijn automatisch verwijderd (stokje-op-stokje regel).
                </div>
              )}
              {ruleNotice && (
                <div style={{ background: "#FFF8E1", border: "1px solid #F0D9A5", borderRadius: "6px", padding: "8px 14px", marginBottom: "10px", fontSize: "12px", color: "#6F5A2C" }}>
                  {ruleNotice}
                </div>
              )}

              {/* Mobile: inline tools */}
              {isMobile && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                  {[
                    { id: "colorA", l: "A", bg: colA.hex },
                    { id: "colorB", l: "B", bg: colB.hex },
                    { id: "symbol", l: "S" },
                    { id: "erase", l: "W" },
                    { id: "toggle", l: "T" },
                  ].map(t => (
                    <button key={t.id} onClick={() => setTool(t.id)} style={{
                      ...btnTool, background: tool === t.id ? (t.bg || B.orange) : B.white,
                      color: tool === t.id ? B.white : B.dark,
                      borderColor: tool === t.id ? (t.bg || B.orange) : B.beige,
                    }}>{t.l}</button>
                  ))}
                  <button onClick={() => { pushHistory(chart); applyValidatedChart(chart.map(r => r.map(c => !c)), { notify: true }); }} style={btnSm}>◐</button>
                  <button onClick={() => { pushHistory(chart); applyValidatedChart(chart.map(r => [...r].reverse()), { notify: true }); }} style={btnSm}>↔</button>
                  <button onClick={() => { pushHistory(chart); applyValidatedChart([...chart].reverse(), { notify: true }); }} style={btnSm}>↕</button>
                  <button onClick={undo} disabled={!canUndo} style={{ ...btnSm, opacity: canUndo ? 1 : 0.35 }}>↩</button>
                  <button onClick={redo} disabled={!canRedo} style={{ ...btnSm, opacity: canRedo ? 1 : 0.35 }}>↪</button>
                  <input type="range" min={2} max={18} value={cellSize} onChange={e => setCellSize(parseInt(e.target.value))} style={{ width: "80px" }} />
                </div>
              )}

              <div style={{ overflow: "auto", maxHeight: "80vh", background: B.white, borderRadius: "6px", padding: "12px", border: `1px solid ${B.beige}` }}>
                <ChartCanvas chart={chart} setChart={setChart} cellSize={cellSize} colA={colA} colB={colB} tool={tool} mode="edit" config={projConfig} onRuleMessage={showRuleNotice} onDrawStart={() => pushHistory(chart)} />
              </div>
            </div>

            {/* RIGHT SIDEBAR (desktop) */}
            {!isMobile && (
              <aside style={{ position: "sticky", top: "64px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <Panel title="Preview">
                  <div style={{ borderRadius: "6px", overflow: "hidden" }}>
                    <VisualPreview chart={chart} colA={colA} colB={colB} />
                  </div>
                </Panel>
                <Panel title="Project details">
                  <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.8 }}>
                    <div>Afmetingen: <strong>{projConfig.showEdges ? gridW + 2 : gridW} × {gridH}</strong> st.</div>
                    <div>Totaal steken: <strong>{((projConfig.showEdges ? gridW + 2 : gridW) * gridH).toLocaleString("nl-NL")}</strong></div>
                    {projConfig.showEdges && <div style={{ fontSize: "11px", color: "#888" }}>({gridW} patroon + 2 kantsteken)</div>}
                  </div>
                </Panel>
                {stitchStats && (
                  <Panel title="Garen verbruik">
                    <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <span style={{ width: "14px", height: "14px", borderRadius: "3px", background: colA.hex, border: "1px solid #ccc", flexShrink: 0 }} />
                        <span><strong>{colA.name}:</strong> {stitchStats.colorACells.toLocaleString("nl-NL")} ({stitchStats.colorAPercent}%)</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <span style={{ width: "14px", height: "14px", borderRadius: "3px", background: colB.hex, border: "1px solid #ccc", flexShrink: 0 }} />
                        <span><strong>{colB.name}:</strong> {stitchStats.colorBCells.toLocaleString("nl-NL")} ({stitchStats.colorBPercent}%)</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${B.border}`, paddingTop: "6px", fontSize: "11px" }}>
                        Stokjes: {stitchStats.dcCount.toLocaleString("nl-NL")} · Vasten: {stitchStats.scCount.toLocaleString("nl-NL")}
                      </div>
                    </div>
                  </Panel>
                )}
                <Panel title="Instellingen">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
                      <input type="checkbox" checked={projConfig.showEdges} onChange={e => setProjConfig({ ...projConfig, showEdges: e.target.checked })} />
                      Toon kantsteken
                    </label>
                    <select value={projConfig.direction} onChange={e => setProjConfig({ ...projConfig, direction: e.target.value })} style={{ ...inp, width: "100%", textAlign: "left" }}>
                      <option value="RtoL">Start Rechts (←)</option>
                      <option value="LtoR">Start Links (→)</option>
                    </select>
                  </div>
                </Panel>
              </aside>
            )}
          </div>
        )}

        {step === "pattern" && chart && (
          <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "280px minmax(0,1fr) 260px", gap: "16px", alignItems: "start" }}>

            {/* LEFT: Section settings + chart previews */}
            <div style={{ maxHeight: isMobile ? "none" : "85vh", overflowY: isMobile ? "visible" : "auto" }}>
              <Panel title="Chart secties">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={lbl}>Modus:</span>
                    <select value={splitMode} onChange={e => setSplitMode(e.target.value)} style={{ ...inp, width: "100%", textAlign: "left" }}>
                      <option value="equal">Gelijke delen</option>
                      <option value="fixed">Vaste rij-grootte</option>
                      <option value="manual">Handmatig</option>
                    </select>
                  </div>
                  {splitMode === "equal" && (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={lbl}>Aantal:</span>
                      <input type="number" min={2} max={10} value={splitCount} onChange={e => setSplitCount(Math.max(2, Math.min(10, parseInt(e.target.value) || 2)))} style={inp} />
                      <span style={{ fontSize: "11px", color: "#888" }}>delen</span>
                    </div>
                  )}
                  {splitMode === "fixed" && (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={lbl}>Rijen:</span>
                      <input type="number" min={10} max={200} value={splitRowSize} onChange={e => setSplitRowSize(Math.max(10, Math.min(200, parseInt(e.target.value) || 10)))} style={inp} />
                      <span style={{ fontSize: "11px", color: "#888" }}>per sectie</span>
                    </div>
                  )}
                  {splitMode === "manual" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ fontSize: "11px", color: "#666" }}>Knippunten (rijnummer):</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                        {splitPoints.map((pt, i) => (
                          <span key={i} style={{ background: B.cream, border: `1px solid ${B.beige}`, borderRadius: "4px", padding: "2px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            rij {pt}
                            <button onClick={() => setSplitPoints(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#c00", cursor: "pointer", fontSize: "11px", padding: 0 }}>x</button>
                          </span>
                        ))}
                        <button onClick={() => {
                          const val = prompt(`Knippunt na rij (1-${chart.length - 1}):`);
                          const num = parseInt(val);
                          if (num > 0 && num < chart.length && !splitPoints.includes(num)) setSplitPoints(prev => [...prev, num]);
                        }} style={{ ...btnSm, padding: "2px 8px", fontSize: "11px" }}>+ Knip</button>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: "11px", color: "#888", borderTop: `1px solid ${B.border}`, paddingTop: "6px" }}>
                    {chartSections.length} {chartSections.length === 1 ? "sectie" : "secties"} · {chart.length} rijen totaal
                  </div>
                </div>
              </Panel>

              {chartSections.length > 1 && chartSections.map((sec, i) => (
                <div key={i} style={{ marginTop: "8px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: B.orange, marginBottom: "4px" }}>
                    {sec.label} (rij {chart.length - sec.endRow + 1}–{chart.length - sec.startRow})
                  </div>
                  <div style={{ background: B.white, borderRadius: "6px", padding: "8px", border: `1px solid ${B.beige}` }}>
                    <ChartCanvas chart={sec.chartSlice} setChart={setChart} cellSize={Math.max(2, Math.min(3, Math.floor(250 / Math.max(chart[0].length, sec.chartSlice.length))))} colA={colA} colB={colB} tool={tool} mode="view" config={projConfig} />
                  </div>
                </div>
              ))}

              <div style={{ marginTop: "12px" }}>
                <div style={panelLabel}>Totaaloverzicht</div>
                <div style={{ background: B.white, borderRadius: "6px", padding: "12px", border: `1px solid ${B.beige}`, marginBottom: "12px" }}>
                  <ChartCanvas chart={chart} setChart={setChart} cellSize={Math.max(2, Math.min(4, Math.floor(250 / Math.max(chart[0].length, chart.length))))} colA={colA} colB={colB} tool={tool} mode="view" config={projConfig} />
                </div>
                <div style={panelLabel}>Visueel resultaat</div>
                <div style={{ background: B.white, borderRadius: "6px", padding: "12px", border: `1px solid ${B.beige}`, marginBottom: "12px" }}>
                  <VisualPreview chart={chart} colA={colA} colB={colB} />
                </div>
              </div>
            </div>

            {/* CENTER: Written pattern */}
            <div style={{
              background: B.cream, border: `1px solid ${B.beige}`, borderRadius: "6px",
              padding: "16px", maxHeight: "85vh", overflowY: "auto",
              fontFamily: F.mono, fontSize: "11px", lineHeight: "1.5",
            }}>
              <div style={{ fontWeight: 700, fontSize: "24px", color: B.orange, marginBottom: "4px", letterSpacing: "0.02em", fontFamily: F.heading }}>
                {patternText.writtenTitle}
              </div>
              <div style={{ fontFamily: F.body, fontSize: "11px", color: "#666", lineHeight: 1.6, marginBottom: "12px", paddingBottom: "12px", borderBottom: `1px solid ${B.beige}` }}>
                <strong>{patternText.colorsLabelInline}:</strong> {templateText(patternText.colorAInfoTemplate, { name: colA.name })} · {templateText(patternText.colorBInfoTemplate, { name: colB.name })}<br />
                <strong>{patternText.directionLabelInline}:</strong> {projConfig.direction === "RtoL" ? patternText.directionRtoL : patternText.directionLtoR}<br /><br />
                <strong>{patternText.startLabelInline}:</strong> {templateText(patternText.startInlineTemplate, { name: colA.name, chainCount: chart[0].length + 3, stitchCount: chart[0].length + 2 })}
              </div>

              {/* Section tabs */}
              {sectionedPatternRows && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px", paddingBottom: "8px", borderBottom: `1px solid ${B.beige}` }}>
                  <button
                    onClick={() => setActiveSectionTab("full")}
                    style={{
                      ...btnSm, padding: "4px 12px", fontSize: "11px",
                      background: activeSectionTab === "full" ? B.orange : B.white,
                      color: activeSectionTab === "full" ? B.white : B.dark,
                      borderColor: activeSectionTab === "full" ? B.orange : B.border,
                      fontWeight: activeSectionTab === "full" ? 700 : 400,
                    }}
                  >Volledig</button>
                  {sectionedPatternRows.map((sec, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSectionTab(i)}
                      style={{
                        ...btnSm, padding: "4px 12px", fontSize: "11px",
                        background: activeSectionTab === i ? B.orange : B.white,
                        color: activeSectionTab === i ? B.white : B.dark,
                        borderColor: activeSectionTab === i ? B.orange : B.border,
                        fontWeight: activeSectionTab === i ? 700 : 400,
                      }}
                    >Deel {i + 1}</button>
                  ))}
                </div>
              )}

              {/* Pattern rows — full or section */}
              {(() => {
                const displayRows = (activeSectionTab !== "full" && sectionedPatternRows && sectionedPatternRows[activeSectionTab])
                  ? sectionedPatternRows[activeSectionTab].rows
                  : patternRows;
                const rowOffset = (activeSectionTab !== "full" && sectionedPatternRows && sectionedPatternRows[activeSectionTab])
                  ? sectionedPatternRows[activeSectionTab].startRow
                  : 0;
                return displayRows.map((r, i) => {
                  const rowNum = rowOffset + i + 1;
                  const colorIdx = getRowColor(rowNum - 1);
                  return (
                    <div key={i} style={{
                      padding: "3px 8px",
                      background: i % 2 === 0 ? "transparent" : B.beige,
                      borderRadius: "2px", marginBottom: "1px", wordBreak: "break-all",
                      borderLeft: `3px solid ${colorIdx === 0 ? colA.hex : colB.hex}`,
                    }}>{r}</div>
                  );
                });
              })()}
            </div>

            {/* RIGHT SIDEBAR: Print settings & export */}
            {!isMobile && (
              <aside style={{ position: "sticky", top: "64px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <Panel title="Print instellingen">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={lbl}>Papier:</span>
                      <select value={printPaper} onChange={e => setPrintPaper(e.target.value)} style={{ ...inp, width: "80px" }}>
                        <option value="A4">A4</option><option value="A3">A3</option><option value="Letter">Letter</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={lbl}>Oriëntatie:</span>
                      <select value={printOrientation} onChange={e => setPrintOrientation(e.target.value)} style={{ ...inp, width: "90px" }}>
                        <option value="portrait">Staand</option><option value="landscape">Liggend</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={lbl}>Marge:</span>
                      <input type="number" min={3} max={30} step="1" value={printMarginMm} onChange={e => setPrintMarginMm(parseFloat(e.target.value) || 3)} style={{ ...inp, width: "60px" }} />
                      <span style={{ fontSize: "11px", color: "#888" }}>mm</span>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={lbl}>Modus:</span>
                      <select value={printMode} onChange={e => setPrintMode(e.target.value)} style={{ ...inp, width: "100%", textAlign: "left" }}>
                        <option value="single">1 pagina</option><option value="multi">Meerdere pagina's</option>
                      </select>
                    </div>
                    {printMode === "multi" && (
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span style={lbl}>Cel:</span>
                        <input type="number" min={1.2} max={8} step="0.1" value={printCellMm} onChange={e => setPrintCellMm(parseFloat(e.target.value) || 1.2)} style={{ ...inp, width: "60px" }} />
                        <span style={{ fontSize: "11px", color: "#888" }}>mm</span>
                      </div>
                    )}
                    {printLayout && (
                      <div style={{ fontSize: "11px", color: "#888", borderTop: `1px solid ${B.border}`, paddingTop: "6px" }}>
                        {printLayout.pagesX}×{printLayout.pagesY} = {printLayout.totalPages} pagina's · {printLayout.cellMm.toFixed(1)}mm/cel
                      </div>
                    )}
                  </div>
                </Panel>
                <Panel title="Export">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <button onClick={printChart} style={btnSm}>Print / PDF (chart)</button>
                    <button onClick={exportText} style={{ ...btnPri, fontSize: "13px", padding: "10px 16px" }}>Download .txt</button>
                  </div>
                </Panel>
                <Panel title="PDF Patroon">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                    <div>
                      <span style={lbl}>Cover foto:</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                        <input type="file" accept="image/*" onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => setPdfCoverImage(ev.target.result);
                          reader.readAsDataURL(file);
                        }} style={{ fontSize: "11px", width: "100%" }} />
                        {pdfCoverImage && <button onClick={() => setPdfCoverImage(null)} style={{ ...btnSm, padding: "2px 6px", fontSize: "10px" }}>X</button>}
                      </div>
                      {pdfCoverImage && <img src={pdfCoverImage} alt="cover" style={{ marginTop: "4px", maxWidth: "100%", maxHeight: "80px", objectFit: "contain", borderRadius: "4px", border: "1px solid #ccc" }} />}
                    </div>
                    <div>
                      <span style={lbl}>Subtitel:</span>
                      <input type="text" value={pdfSubtitle} onChange={e => setPdfSubtitle(e.target.value)} placeholder="Overlay Mozaïek Deken" style={{ ...inp, width: "100%", marginTop: "2px" }} />
                    </div>
                    <div>
                      <span style={lbl}>Materiaal:</span>
                      <textarea value={pdfMaterialText} onChange={e => setPdfMaterialText(e.target.value)} placeholder="Scheepjes Colour Crafter..." rows={3} style={{ ...inp, width: "100%", marginTop: "2px", resize: "vertical", fontFamily: F.body, fontSize: "11px" }} />
                    </div>
                    <div>
                      <span style={lbl}>Intro tekst:</span>
                      <textarea value={pdfIntroText} onChange={e => setPdfIntroText(e.target.value)} placeholder="Verhaaltekst over het patroon..." rows={3} style={{ ...inp, width: "100%", marginTop: "2px", resize: "vertical", fontFamily: F.body, fontSize: "11px" }} />
                    </div>
                    <div>
                      <span style={lbl}>Afwerking:</span>
                      <textarea value={pdfFinishText} onChange={e => setPdfFinishText(e.target.value)} placeholder="Enveloprand instructies..." rows={3} style={{ ...inp, width: "100%", marginTop: "2px", resize: "vertical", fontFamily: F.body, fontSize: "11px" }} />
                    </div>
                    <button
                      onClick={generatePatternPDF}
                      disabled={pdfGenerating}
                      style={{ ...btnPri, fontSize: "14px", padding: "12px 16px", opacity: pdfGenerating ? 0.6 : 1 }}
                    >
                      {pdfGenerating ? "Bezig met genereren..." : "Genereer PDF"}
                    </button>
                  </div>
                </Panel>
              </aside>
            )}

            {/* Mobile: inline controls */}
            {isMobile && (
              <div style={{ marginTop: "16px" }}>
                <Panel title="Print & Export">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                    <select value={printPaper} onChange={e => setPrintPaper(e.target.value)} style={{ ...inp, width: "70px" }}>
                      <option value="A4">A4</option><option value="A3">A3</option><option value="Letter">Letter</option>
                    </select>
                    <select value={printMode} onChange={e => setPrintMode(e.target.value)} style={{ ...inp, width: "auto" }}>
                      <option value="single">1 pagina</option><option value="multi">Multi</option>
                    </select>
                    <button onClick={printChart} style={btnSm}>Print</button>
                    <button onClick={exportText} style={btnPri}>Download .txt</button>
                    <button onClick={generatePatternPDF} disabled={pdfGenerating} style={{ ...btnPri, opacity: pdfGenerating ? 0.6 : 1 }}>{pdfGenerating ? "Bezig..." : "PDF"}</button>
                  </div>
                </Panel>
              </div>
            )}
          </div>
        )}
          </div>
      </main>

      {/* Save Modal */}
      {showSaveModal && (
        <div style={saveModalOverlay} onClick={() => setShowSaveModal(false)}>
          <div style={saveModalBox} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowSaveModal(false)} style={saveModalCloseBtn}>✕</button>
            <h2 style={saveModalTitle}>Patroon Opslaan</h2>
            <div style={saveModalForm}>
              <div style={saveModalField}>
                <label style={saveModalLabel}>Naam *</label>
                <input
                  type="text"
                  value={saveDraftTitle}
                  onChange={(e) => setSaveDraftTitle(e.target.value)}
                  placeholder="Bijv: Giraffe Patroon"
                  style={saveModalInput}
                  autoFocus
                />
              </div>
              <div style={saveModalField}>
                <label style={saveModalLabel}>Map</label>
                <select
                  value={saveDraftFolderId}
                  onChange={(e) => setSaveDraftFolderId(e.target.value)}
                  style={saveModalInput}
                >
                  {selectableFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div style={saveModalStats}>
                <div>📐 {chart?.[0]?.length || 0} × {chart?.length || 0} steken</div>
                <div>🎨 {colA.name} & {colB.name}</div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button onClick={() => setShowSaveModal(false)} style={saveModalCancelBtn}>
                  Annuleren
                </button>
                <button onClick={confirmSaveChart} style={saveModalSaveBtn}>
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuIcon({ name }) {
  const base = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (name === "upload") {
    return (
      <svg {...base}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.3" />
        <path d="M5.5 17l5-4 3 2 4.5-4" />
      </svg>
    );
  }
  if (name === "adjust") {
    return (
      <svg {...base}>
        <path d="M4 7h16" />
        <path d="M4 17h16" />
        <circle cx="9" cy="7" r="2" />
        <circle cx="15" cy="17" r="2" />
      </svg>
    );
  }
  if (name === "edit") {
    return (
      <svg {...base}>
        <path d="M4 20l4-.8L19 8.2 15.8 5 4.8 16z" />
        <path d="M14.8 6l3.2 3.2" />
      </svg>
    );
  }
  if (name === "pattern") {
    return (
      <svg {...base}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 10h16M10 4v16M16 4v16" />
      </svg>
    );
  }
  if (name === "new") {
    return (
      <svg {...base}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    );
  }
  if (name === "save") {
    return (
      <svg {...base}>
        <path d="M5 4h12l2 2v14H5z" />
        <path d="M8 4v6h8V4" />
        <path d="M8 20v-6h8v6" />
      </svg>
    );
  }
  if (name === "settings") {
    return (
      <svg {...base}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7.2 7.2l1.4 1.4M15.4 15.4l1.4 1.4M16.8 7.2l-1.4 1.4M8.6 15.4l-1.4 1.4" />
      </svg>
    );
  }
  if (name === "palette") {
    return (
      <svg {...base}>
        <rect x="4" y="5" width="6" height="6" rx="1.2" />
        <rect x="14" y="5" width="6" height="6" rx="1.2" />
        <rect x="4" y="13" width="6" height="6" rx="1.2" />
        <path d="M14 16h6" />
      </svg>
    );
  }
  if (name === "translate") {
    return (
      <svg {...base}>
        <path d="M4 6h8M8 4v2M8 6c0 4-2 7-5 9" />
        <path d="M3 15l3 3m0 0l3-3m-3 3v3" />
        <path d="M14 7h7M17.5 7v11" />
        <path d="M14 18h7" />
      </svg>
    );
  }
  if (name === "library") {
    return (
      <svg {...base}>
        <path d="M4 6a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2z" />
        <path d="M20 6a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  if (name === "folders") {
    return (
      <svg {...base}>
        <path d="M3 8h7l2 2h9v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M3 8V6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2" />
      </svg>
    );
  }
  if (name === "login") {
    return (
      <svg {...base}>
        <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
        <path d="M14 8l5 4-5 4" />
        <path d="M19 12H9" />
      </svg>
    );
  }
  if (name === "logout") {
    return (
      <svg {...base}>
        <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
        <path d="M14 8l5 4-5 4" />
        <path d="M19 12H9" />
      </svg>
    );
  }
  if (name === "delete") {
    return (
      <svg {...base}>
        <path d="M4 7h16" />
        <path d="M9 7V5h6v2" />
        <path d="M7 7l1 13h8l1-13" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    );
  }
  return null;
}

function Panel({ title, children }) {
  return (
    <div style={{ background: B.white, border: `1px solid ${B.border}`, borderRadius: "6px", padding: "10px 14px", boxShadow: "0 4px 6px rgba(0,0,0,0.08)" }}>
      <div style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "0.02em", color: B.orange, marginBottom: "8px", fontFamily: F.heading }}>{title}</div>
      {children}
    </div>
  );
}

function ColorPick({ label, color, set, palette = [], onPickFromPalette, onSaveToPalette }) {
  const selectedPaletteIndex = palette.findIndex(
    entry => entry.name.trim().toLowerCase() === String(color.name || "").trim().toLowerCase()
      && entry.hex.toUpperCase() === String(color.hex || "").toUpperCase(),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "160px" }}>
      <span style={{ fontSize: "9px", color: "#888" }}>{label}</span>
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <input type="color" value={normalizeHexColor(color.hex) || "#000000"} onChange={e => set({ ...color, hex: e.target.value })}
          style={{ width: "26px", height: "26px", border: "none", borderRadius: "6px", cursor: "pointer", padding: 0 }} />
        <input type="text" value={color.name} onChange={e => set({ ...color, name: e.target.value })}
          style={{ ...inp, width: "90px", fontSize: "11px", textAlign: "left" }} placeholder="Naam" />
      </div>
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <input
          type="text"
          value={color.hex}
          onChange={e => set({ ...color, hex: e.target.value })}
          style={{ ...inp, width: "90px", fontSize: "11px", textAlign: "left" }}
          placeholder="#RRGGBB"
        />
        <button style={{ ...btnSm, padding: "5px 8px", fontSize: "11px" }} onClick={onSaveToPalette}>
          In palet
        </button>
      </div>
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <select
          value={selectedPaletteIndex >= 0 ? String(selectedPaletteIndex) : ""}
          onChange={(e) => {
            if (e.target.value === "") return;
            const idx = Number(e.target.value);
            if (Number.isNaN(idx)) return;
            const picked = palette[idx];
            if (!picked) return;
            onPickFromPalette?.(picked);
          }}
          style={{ ...inp, width: "140px", textAlign: "left" }}
        >
          <option value="">Kies uit palet</option>
          {palette.map((entry, idx) => (
            <option key={`${entry.name}-${entry.hex}-${idx}`} value={idx}>
              {entry.name} ({entry.hex}){entry.locked ? " [basis]" : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const panelLabel = { fontSize: "16px", fontWeight: 700, letterSpacing: "0.02em", color: B.orange, marginBottom: "8px", fontFamily: F.heading };
const lbl = { fontSize: "12px", fontWeight: 600, color: B.brown };
const inp = { width: "55px", padding: "4px 6px", border: `1px solid ${B.beige}`, borderRadius: "6px", fontSize: "12px", background: B.white, outline: "none", textAlign: "center", color: B.dark };
const btnHead = { background: B.white, color: B.orange, border: `1px solid ${B.border}`, borderRadius: "6px", padding: "8px 12px", fontSize: "12px", fontWeight: 700, cursor: "pointer" };
const btnPri = { background: B.orange, color: B.white, border: `1px solid ${B.orange}`, borderRadius: "6px", padding: "10px 24px", fontSize: "14px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.08)" };
const btnSec = { background: B.white, color: B.dark, border: `1px solid ${B.border}`, borderRadius: "6px", padding: "10px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer" };
const btnTool = { border: "1.5px solid", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const btnSm = { background: B.white, border: `1px solid ${B.border}`, borderRadius: "6px", padding: "8px 12px", fontSize: "13px", cursor: "pointer", color: B.brown, whiteSpace: "nowrap" };
const sidebarWrap = { position: "sticky", top: "84px" };
const sidebarSection = { background: B.white, border: `1px solid ${B.border}`, borderRadius: "6px", padding: "12px" };
const sidebarTitle = { fontSize: "16px", fontWeight: 700, letterSpacing: "0.02em", color: B.orange, marginBottom: "10px", fontFamily: F.heading };
const btnSidebar = { background: B.white, border: `1px solid ${B.border}`, borderRadius: "6px", padding: "12px 14px", fontSize: "14px", textAlign: "left", color: B.dark, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", gap: "10px" };
const sidebarIconWrap = { width: "18px", color: "#6f6c75", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const sidebarCloudCard = { marginTop: "auto", background: B.cream, border: `1px solid ${B.border}`, borderRadius: "8px", padding: "12px", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" };
const sidebarCloudHeader = { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" };
const sidebarCloudDot = { width: "10px", height: "10px", borderRadius: "999px", boxShadow: "0 0 0 2px rgba(255,255,255,0.9)" };
const sidebarCloudTitle = { fontSize: "13px", fontWeight: 700, color: B.orange };
const sidebarCloudState = { fontSize: "12px", fontWeight: 700, color: B.dark, marginBottom: "4px" };
const sidebarCloudText = { fontSize: "11px", color: "#6f6c75", lineHeight: 1.4, overflowWrap: "anywhere" };
const dropdownWrap = { position: "absolute", top: "100%", right: 0, marginTop: "4px", background: B.white, border: `1px solid ${B.border}`, borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "6px 0", minWidth: "200px", zIndex: 200 };
const dropdownItem = { display: "block", width: "100%", padding: "10px 16px", fontSize: "13px", color: B.dark, background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontFamily: F.body };

// Save Modal styles
const saveModalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" };
const saveModalBox = { background: B.white, borderRadius: "16px", padding: "32px", maxWidth: "420px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", position: "relative" };
const saveModalCloseBtn = { position: "absolute", top: "16px", right: "16px", background: "transparent", border: "none", fontSize: "24px", cursor: "pointer", color: "#999", width: "32px", height: "32px", borderRadius: "50%" };
const saveModalTitle = { fontSize: "24px", fontWeight: 800, color: B.orange, marginBottom: "24px", fontFamily: F.heading };
const saveModalForm = { display: "flex", flexDirection: "column", gap: "16px" };
const saveModalField = { display: "flex", flexDirection: "column", gap: "6px" };
const saveModalLabel = { fontSize: "12px", fontWeight: 600, color: B.dark, textTransform: "uppercase", letterSpacing: "0.5px" };
const saveModalInput = { padding: "12px 16px", border: `2px solid ${B.beige}`, borderRadius: "8px", fontSize: "14px", outline: "none", fontFamily: F.body, width: "100%", boxSizing: "border-box" };
const saveModalStats = { display: "flex", gap: "16px", padding: "12px", background: B.cream, borderRadius: "8px", fontSize: "12px", color: "#666" };
const saveModalSaveBtn = { flex: 1, background: B.orange, color: B.white, border: "none", borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 16px ${B.orange}40` };
const saveModalCancelBtn = { flex: 1, background: B.white, color: B.dark, border: `2px solid ${B.beige}`, borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer" };
