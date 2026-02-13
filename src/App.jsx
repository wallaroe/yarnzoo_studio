import { useState, useCallback, useRef, useEffect } from "react";

// ============================================================
// YARNZOO MOSAIC STUDIO v0.3 — Correct Overlay Mosaic Logic
// ============================================================

const B = {
  orange: "#F5921B", orangeLight: "#F7A63E",
  darkGreen: "#2D5A27", lightGreen: "#4A8C3F",
  cream: "#FAF7F2", beige: "#EDE8DF",
  brown: "#5C4033", dark: "#2A2A2A", white: "#FFFFFF",
};

/*
  OVERLAY MOSAIC CROCHET LOGIC:
  
  The grid represents the CHART. Each cell has a color (A or B) and may have a symbol.
  
  - Rows alternate color: row 1 = color A, row 2 = color B, row 3 = color A, etc.
  - On a Color A row, you read ALL cells left to right:
    - Cell without symbol → SC in back loop only (vaste in achterste lus) in color A
    - Cell with symbol → DC in front loop 2 rows below (stokje in voorste lus) in color A
  - Same for Color B rows.
  
  GOLDEN RULE: A DC (symbol) can NEVER be directly above another DC.
  If row N has a symbol at position X, then row N+1 at position X MUST be a plain SC.
  
  The chart stores per cell:
  - color: 0 (color A) or 1 (color B) — determined by row number
  - symbol: boolean — whether this cell is a DC (stokje)
  
  When converting from image:
  - Dark pixels on even rows (color B rows) → symbol on that row (DC in color B)
  - Dark pixels on odd rows (color A rows) → symbol on that row (DC in color A)
  - We validate no-stacking rule after conversion
*/

const createEmptyChart = (w, h) =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => false)); // false = no symbol (SC), true = symbol (DC)

// Get row color: row 0 (bottom) = A, row 1 = B, row 2 = A, etc.
const getRowColor = (rowIdx) => (rowIdx % 2 === 0 ? 0 : 1); // 0=A, 1=B

// Validate no-stacking rule: if chart[y][x] is true, chart[y-1][x] must be false (y-1 = row above)
function validateNoStacking(chart) {
  const h = chart.length, w = chart[0].length;
  const fixed = chart.map(r => [...r]);
  let fixes = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      if (fixed[y][x] && fixed[y + 1][x]) {
        // Conflict: remove symbol from upper row
        fixed[y + 1][x] = false;
        fixes++;
      }
    }
  }
  return { chart: fixed, fixes };
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

  // First pass: determine which pixels are "dark" (overlay)
  const raw = [];
  for (let y = 0; y < targetH; y++) {
    const row = [];
    for (let x = 0; x < targetW; x++) {
      const i = (y * targetW + x) * 4;
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      row.push(gray < threshold);
    }
    raw.push(row);
  }

  // The chart reads bottom-to-top (row 0 = bottom of image)
  // But our array is top-to-bottom, so we work with it as-is
  // and flip when generating the pattern.
  // For the chart: raw[0] = top of image = highest row number

  // A dark pixel means "this should show the overlay color" at this position.
  // On a row of color A: if we want to show color B here, we need a symbol (DC drops down to color B row below)
  // On a row of color B: if we want to show color A here, we need NO symbol (SC shows color B background)
  // Wait — let me think about this more carefully.
  //
  // Actually: the DESIGN shows which color should be visible at each position.
  // - If the design says "dark" at (x,y) and row y is color A:
  //   The dark color is NOT color A, so we need the OTHER color to show.
  //   In overlay mosaic, on a color A row, a DC drops down to pick up color A from 2 rows below.
  //   So a DC on a color A row shows MORE of color A, not less.
  //   Actually no: a DC on a color A row is still in color A but it's a taller stitch.
  //   The COLOR of every stitch on row N is always the row's color.
  //   
  //   The visual effect comes from: on a color A row, plain SCs show color A.
  //   DCs also show color A but they COVER the color B row below them.
  //   So the design is about: where do you want color A to be visible on color B rows?
  //   That happens via DCs on color A rows that overlay the color B SCs below.
  //
  // Let me reconsider:
  // - Row is color A. All stitches are color A.
  //   - SC (no symbol): short stitch, the color B row below still shows through
  //   - DC (symbol): tall stitch that covers the color B below, so you see color A here AND on the row below
  //
  // So for the final visual:
  // - Position (x, y) shows color A if:
  //   - Row y is color A (any stitch), OR
  //   - Row y is color B but the color A row ABOVE (y+1) has a DC at position x
  //     (the DC from the A row above drops down and covers this B row position)
  //
  // Wait, the DC drops DOWN to 2 rows below, but visually it covers the row directly below.
  // So a DC on row y (color A) covers position x on row y-1 (color B).
  //
  // For the IMAGE conversion:
  // We want: if position (x,y) should be dark (color B), then either:
  //   - row y is a B row and no A-row DC covers it (no DC at (x, y+1) where y+1 is an A row)
  //   - row y is an A row: not possible to show B on an A row directly,
  //     but the A-row SC is short enough that the B row below peeks through
  //
  // This is getting complex. Let me simplify:
  // The CHART is what the designer draws. Each cell = one stitch position.
  // Symbol = DC, no symbol = SC.
  // The visual pattern emerges from the combination.
  // 
  // For a simple image-to-chart conversion, let's do:
  // If the pixel is "dark" (part of the design), place a symbol (DC) there.
  // Then validate no-stacking rule.

  // RE-IMPLEMENTING logic to match the USER requirement:
  // "Lookahead" logic: A stitch on Row N is determined by whether the Row BELOW (N-1)
  // needs to be covered to show the correct visual color.

  const chart = Array.from({ length: targetH }, () => Array(targetW).fill(false));

  for (let y = 0; y < targetH; y++) {
    const rowNum = targetH - y; // 1-based index from bottom (1..H)

    // Bottom row (rowNum 1) cannot drop stitches down further, so it stays SC.
    if (rowNum === 1) continue;

    const isRowColorA = (rowNum % 2) !== 0; // Odd rows = Color A (Light)

    // Check row BELOW (y+1).
    // Determine what visual color is needed at row BELOW.
    for (let x = 0; x < targetW; x++) {
      // Is the pixel at y+1 "dark" (Color B)?
      const targetIsDark = raw[y + 1][x];

      // Current Row N is Color A (Light).
      if (isRowColorA) {
        // If row below needs to be Light (but is naturally Dark B),
        // We drop a DC from here (Light A) to make it Light.
        if (!targetIsDark) {
          chart[y][x] = true;
        }
      }
      // Current Row N is Color B (Dark).
      else {
        // If row below needs to be Dark (but is naturally Light A),
        // We drop a DC from here (Dark B) to make it Dark.
        if (targetIsDark) {
          chart[y][x] = true;
        }
      }
    }
  }

  // Validate no-stacking
  return validateNoStacking(chart);
}

// ============================================================
// Pattern Generation
// ============================================================
function generateWrittenPattern(chart, colA, colB) {
  const h = chart.length, w = chart[0].length;
  const rows = [];

  for (let rowNum = 1; rowNum <= h; rowNum++) {
    // Row 1 is bottom of chart = chart[h-1]
    const chartY = h - rowNum;
    const colorIdx = getRowColor(rowNum - 1); // 0=A, 1=B
    const colorName = colorIdx === 0 ? colA.name : colB.name;

    // Build stitch groups
    const stitches = [];
    let curType = null, count = 0;

    for (let x = 0; x < w; x++) {
      const hasSymbol = chart[chartY][x];
      const stType = hasSymbol ? "stk" : "v";

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

    rows.push(`Rij ${rowNum}: (KS ${colorName}), ${stitchStr}, (KS ${colorName})`);
  }

  return rows;
}

// ============================================================
// Chart Canvas — shows colored grid with symbols
// ============================================================
function ChartCanvas({ chart, setChart, cellSize, colA, colB, tool, mode }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const lastCell = useRef(null);
  const w = chart[0]?.length || 0, h = chart.length;

  const draw = useCallback(() => {
    const c = ref.current;
    if (!c || !w || !h) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const margin = 32;
    c.width = (w * cellSize + margin) * dpr;
    c.height = (h * cellSize + 4) * dpr;
    c.style.width = `${w * cellSize + margin}px`;
    c.style.height = `${h * cellSize + 4}px`;
    ctx.scale(dpr, dpr);

    const colAHex = colA.hex;
    const colBHex = colB.hex;

    for (let y = 0; y < h; y++) {
      // Row number (from bottom): h - y
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowColor = colorIdx === 0 ? colAHex : colBHex;
      const rowColorLight = colorIdx === 0 ? colAHex + "40" : colBHex + "40";

      for (let x = 0; x < w; x++) {
        const hasSymbol = chart[y][x];
        const isCovered = y > 0 && chart[y - 1][x];

        // Cell background
        // Basic rule: row's color
        // VISUAL OVERRIDE: If the cell directly ABOVE has a symbol (DC), it drops down
        // and covers this cell. So this cell should show the color of the row ABOVE.
        let bgFill = rowColor;
        if (isCovered) {
          const rowNumAbove = h - (y - 1);
          const idxAbove = getRowColor(rowNumAbove - 1);
          bgFill = idxAbove === 0 ? colAHex : colBHex;
        }

        ctx.fillStyle = bgFill;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

        // Draw symbol (X) for DC stitches - Standard Mosaic Chart Style
        // The X overlays the solid color to indicate a drop-down stitch
        if (hasSymbol && cellSize >= 5) {
          // Determine contrast color for the symbol
          const r = parseInt(rowColor.slice(1, 3), 16);
          const g = parseInt(rowColor.slice(3, 5), 16);
          const b = parseInt(rowColor.slice(5, 7), 16);
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;

          ctx.strokeStyle = brightness > 128 ? "rgba(0, 0, 0, 0.6)" : "rgba(255, 255, 255, 0.85)";
          ctx.lineWidth = 1.5;

          const pad = cellSize * 0.15;
          const x1 = x * cellSize + pad;
          const y1 = y * cellSize + pad;
          const x2 = (x + 1) * cellSize - pad;
          const y2 = (y + 1) * cellSize - pad;

          ctx.beginPath();
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
          ctx.moveTo(x2, y1); ctx.lineTo(x1, y2);
          ctx.stroke();
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x++) {
      ctx.beginPath(); ctx.moveTo(x * cellSize, 0); ctx.lineTo(x * cellSize, h * cellSize); ctx.stroke();
    }
    for (let y = 0; y <= h; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cellSize); ctx.lineTo(w * cellSize, y * cellSize); ctx.stroke();
    }

    // Bold lines every 10
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 10) {
      ctx.beginPath(); ctx.moveTo(x * cellSize, 0); ctx.lineTo(x * cellSize, h * cellSize); ctx.stroke();
    }
    for (let y = 0; y <= h; y += 10) {
      ctx.beginPath(); ctx.moveTo(0, y * cellSize); ctx.lineTo(w * cellSize, y * cellSize); ctx.stroke();
    }

    // Row numbers on the right with color indicator
    const fontSize = Math.max(7, Math.min(11, cellSize * 0.55));
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = "left";
    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowColor = colorIdx === 0 ? colAHex : colBHex;
      ctx.fillStyle = rowColor;
      // Color dot
      ctx.beginPath();
      ctx.arc(w * cellSize + 6, y * cellSize + cellSize / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      // Number
      ctx.fillStyle = "#666";
      ctx.fillText(`${rowNum}`, w * cellSize + 12, y * cellSize + cellSize * 0.7);
    }
  }, [chart, cellSize, colA, colB, w, h]);

  useEffect(() => { draw(); }, [draw]);

  const getCell = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / cellSize);
    const y = Math.floor((e.clientY - r.top) / cellSize);
    return (x >= 0 && x < w && y >= 0 && y < h) ? { x, y } : null;
  };

  const paint = (x, y) => {
    const g = chart.map(r => [...r]);
    if (tool === "symbol") {
      g[y][x] = true;
    } else if (tool === "erase") {
      g[y][x] = false;
    } else {
      g[y][x] = !g[y][x];
    }

    // Enforce no-stacking rule
    if (g[y][x]) {
      // If we placed a symbol, remove symbol directly above and below
      if (y > 0 && g[y - 1][x]) g[y - 1][x] = false;
      if (y < h - 1 && g[y + 1][x]) g[y + 1][x] = false;
    }

    setChart(g);
  };

  const onDown = (e) => {
    if (mode !== "edit") return;
    e.preventDefault(); drawing.current = true;
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
      style={{ cursor: mode === "edit" ? "crosshair" : "default", borderRadius: "4px", display: "block" }} />
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

    // Build visual representation
    // For each position, determine which color is visually dominant
    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowHex = colorIdx === 0 ? colA.hex : colB.hex;
      const otherHex = colorIdx === 0 ? colB.hex : colA.hex;

      for (let x = 0; x < w; x++) {
        if (chart[y][x]) {
          // DC: this row's color overlays, covering the row below
          ctx.fillStyle = rowHex;
        } else {
          // SC: short stitch, the row below might show through
          // But visually it still shows this row's color at this position
          // The visual effect of SC is that it's the row color
          // but DCs from ABOVE can cover this position
          ctx.fillStyle = rowHex;
        }
        ctx.fillRect(x * s, y * s, s, s);
      }
    }

    // Second pass: DCs cover the row below them visually
    for (let y = 0; y < h - 1; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowHex = colorIdx === 0 ? colA.hex : colB.hex;

      for (let x = 0; x < w; x++) {
        if (chart[y][x]) {
          // This DC covers position (x, y+1) visually
          ctx.fillStyle = rowHex;
          const s2 = s;
          ctx.fillRect(x * s2, (y + 1) * s2, s2, s2);
        }
      }
    }
  }, [chart, colA, colB]);

  return <canvas ref={ref} style={{ width: "100%", imageRendering: "pixelated", borderRadius: "4px" }} />;
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
  const [colA, setColA] = useState({ name: "Zandvoort", hex: "#E8DCC8" });
  const [colB, setColB] = useState({ name: "Arnhem", hex: "#C75050" });
  const previewRef = useRef(null);

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

  // Generate preview
  useEffect(() => {
    if (step !== "adjust" || !previewRef.current || !imgEl) return;
    const { chart: preview } = imageToChart(imgEl, gridW, gridH, threshold);
    const c = previewRef.current;
    const ctx = c.getContext("2d");
    const s = Math.max(1, Math.min(4, Math.floor(450 / Math.max(gridW, gridH))));
    c.width = gridW * s; c.height = gridH * s;

    for (let y = 0; y < gridH; y++) {
      const rowNum = gridH - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowHex = colorIdx === 0 ? colA.hex : colB.hex;
      const rowHexLight = colorIdx === 0 ? colA.hex + "50" : colB.hex + "50";
      for (let x = 0; x < gridW; x++) {
        ctx.fillStyle = preview[y][x] ? rowHex : rowHexLight;
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
  }, [step, imgEl, gridW, gridH, threshold, colA, colB]);

  const confirmGrid = () => {
    const { chart: c, fixes } = imageToChart(imgEl, gridW, gridH, threshold);
    setChart(c);
    setFixCount(fixes);
    setCellSize(Math.max(2, Math.min(10, Math.floor(900 / Math.max(gridW, gridH)))));
    setStep("edit");
  };

  const patternRows = chart ? generateWrittenPattern(chart, colA, colB) : [];

  const stats = chart ? {
    symbols: chart.flat().filter(c => c).length,
    plain: chart.flat().filter(c => !c).length,
    total: chart.flat().length,
  } : {};

  const exportText = () => {
    const hdr = [
      `HAAKPATROON — Overlay Mozaiek`,
      `Afmetingen: ${gridW} steken breed x ${gridH} rijen hoog`,
      ``,
      `Kleuren:`,
      `  ${colA.name} (kleur A): oneven rijen`,
      `  ${colB.name} (kleur B): even rijen`,
      ``,
      `Steken:`,
      `  v = vaste in de achterste lus`,
      `  stk = stokje in de voorste lus, 2 rijen lager`,
      `  KS = kantsteek`,
      ``,
      `Start: maak met ${colA.name} een lossenketting van ${gridW + 3} lossen,`,
      `start in de 2e losse vanaf de haaknaald met in elke losse een v [${gridW + 2}]. Hecht af.`,
      ``,
      `GESCHREVEN TEKST:`,
      ``,
    ].join("\n");
    const txt = hdr + patternRows.join("\n");
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "haakpatroon.txt"; a.click();
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${B.cream} 0%, #EDEADF 100%)`, fontFamily: "'Segoe UI', sans-serif", color: B.dark }}>
      {/* Header */}
      <header style={{ background: B.darkGreen, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 20px rgba(0,0,0,0.15)" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: B.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🐒</div>
            <div>
              <span style={{ color: B.orange, fontWeight: 800, fontSize: "18px" }}>YarnZoo</span>
              <span style={{ color: B.lightGreen, fontSize: "9px", letterSpacing: "2px", textTransform: "uppercase", marginLeft: "8px" }}>Mosaic Studio v0.3</span>
            </div>
          </div>
          <Steps current={step} />
        </div>
        <div style={{ height: "3px", background: `linear-gradient(90deg, ${B.lightGreen}, ${B.orange}, ${B.lightGreen})` }} />
      </header>

      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>

        {/* STEP 1: UPLOAD */}
        {step === "upload" && (
          <div style={{ textAlign: "center", paddingTop: "60px" }}>
            <h1 style={{ fontSize: "28px", color: B.darkGreen, marginBottom: "8px", fontWeight: 800 }}>Upload je ontwerp</h1>
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
              <div style={{ fontSize: "48px" }}>🖼️</div>
              <div style={{ fontSize: "16px", fontWeight: 600, color: B.darkGreen }}>Klik om een afbeelding te kiezen</div>
              <div style={{ fontSize: "12px", color: "#aaa" }}>JPG, PNG — bij voorkeur 2 kleuren / hoog contrast</div>
              <input type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
            </label>
          </div>
        )}

        {/* STEP 2: ADJUST */}
        {step === "adjust" && (
          <div>
            <h2 style={{ fontSize: "20px", color: B.darkGreen, marginBottom: "16px" }}>Pas de conversie aan</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div>
                <div style={panelLabel}>Originele afbeelding</div>
                <div style={{ background: B.white, borderRadius: "8px", padding: "12px", border: `1px solid ${B.beige}`, textAlign: "center" }}>
                  <img src={origImage} alt="Original" style={{ maxWidth: "100%", maxHeight: "400px", borderRadius: "4px" }} />
                </div>
              </div>
              <div>
                <div style={panelLabel}>Telpatroon preview ({gridW} × {gridH})</div>
                <div style={{ background: B.white, borderRadius: "8px", padding: "12px", border: `1px solid ${B.beige}`, textAlign: "center" }}>
                  <canvas ref={previewRef} style={{ maxWidth: "100%", imageRendering: "pixelated", borderRadius: "4px" }} />
                </div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "6px" }}>
                  Volle kleur = stokje (DC/symbool) · Lichte kleur = vaste (SC) · Rijen wisselen om en om van kleur
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "20px" }}>
              <Panel title="Raster afmetingen">
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={lbl}>Breed:</span>
                  <input type="number" min={20} max={300} value={gridW} onChange={e => {
                    const v = parseInt(e.target.value) || 20; setGridW(v);
                    if (imgEl) setGridH(Math.round(v * (imgEl.height / imgEl.width)));
                  }} style={inp} />
                  <span style={lbl}>Hoog:</span>
                  <input type="number" min={20} max={400} value={gridH} onChange={e => setGridH(parseInt(e.target.value) || 20)} style={inp} />
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
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                  <ColorPick label="Kleur A (oneven rijen)" color={colA} set={setColA} />
                  <ColorPick label="Kleur B (even rijen)" color={colB} set={setColB} />
                  <button onClick={() => { const tmp = colA; setColA(colB); setColB(tmp); }} style={{ ...btnSm, marginBottom: "2px" }}>⇄</button>
                </div>
              </Panel>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "center" }}>
              <button onClick={() => setStep("upload")} style={btnSec}>← Terug</button>
              <button onClick={confirmGrid} style={btnPri}>Bevestig en ga bewerken →</button>
            </div>
          </div>
        )}

        {/* STEP 3: EDIT */}
        {step === "edit" && chart && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
              <h2 style={{ fontSize: "20px", color: B.darkGreen, margin: 0 }}>Bewerk je telpatroon</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setStep("adjust")} style={btnSec}>← Conversie</button>
                <button onClick={() => setStep("pattern")} style={btnPri}>🧶 Bekijk patroon →</button>
              </div>
            </div>

            {fixCount > 0 && (
              <div style={{ background: "#FFF3E0", border: "1px solid #FFB74D", borderRadius: "8px", padding: "10px 16px", marginBottom: "12px", fontSize: "13px" }}>
                ⚠️ <strong>{fixCount}</strong> stokjes zijn automatisch verwijderd (stokje-op-stokje regel). Controleer het resultaat.
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
              <Panel title="Gereedschap">
                <div style={{ display: "flex", gap: "4px" }}>
                  {[
                    { id: "symbol", icon: "✏️", l: "Stokje plaatsen" },
                    { id: "erase", icon: "🧹", l: "Wissen" },
                    { id: "toggle", icon: "🔄", l: "Wissel" },
                  ].map(t => (
                    <button key={t.id} onClick={() => setTool(t.id)} style={{
                      ...btnTool, background: tool === t.id ? B.orange : B.white,
                      color: tool === t.id ? B.white : B.dark,
                      borderColor: tool === t.id ? B.orange : B.beige,
                    }}>{t.icon} {t.l}</button>
                  ))}
                </div>
              </Panel>
              <Panel title="Acties">
                <div style={{ display: "flex", gap: "4px" }}>
                  <button onClick={() => setChart(chart.map(r => r.map(c => !c)))} style={btnSm}>◐ Symbolen omkeren</button>
                  <button onClick={() => setChart(chart.map(r => [...r].reverse()))} style={btnSm}>↔ Spiegel H</button>
                  <button onClick={() => setChart([...chart].reverse())} style={btnSm}>↕ Spiegel V</button>
                  <button onClick={() => { const { chart: c, fixes } = validateNoStacking(chart); setChart(c); if (fixes > 0) alert(`${fixes} stokje-op-stokje conflicten opgelost.`); else alert("Geen conflicten gevonden!"); }} style={btnSm}>✓ Valideer</button>
                </div>
              </Panel>
              <Panel title="Zoom">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input type="range" min={2} max={18} value={cellSize} onChange={e => setCellSize(parseInt(e.target.value))} style={{ width: "80px" }} />
                  <span style={{ fontSize: "11px", color: "#888" }}>{cellSize}px</span>
                </div>
              </Panel>
              <Panel title="Statistieken">
                <div style={{ fontSize: "11px", color: "#666" }}>
                  {chart[0].length} × {chart.length} · Stokjes: {stats.symbols} · Vastes: {stats.plain}
                </div>
              </Panel>
            </div>

            {/* Legend */}
            {/* Legend - Restored strict logic */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "12px", fontSize: "11px", color: "#666", flexWrap: "wrap" }}>
              <span><span style={{ display: "inline-block", width: "14px", height: "14px", background: colA.hex, border: "1px solid #ccc", verticalAlign: "middle", marginRight: "4px", borderRadius: "2px" }}></span> Vaste {colA.name}</span>

              <span><span style={{ display: "inline-block", width: "14px", height: "14px", background: colA.hex, border: "1px solid #ccc", verticalAlign: "middle", marginRight: "4px", borderRadius: "2px", textAlign: "center", color: (parseInt(colA.hex.slice(1, 3), 16) * 299 + parseInt(colA.hex.slice(3, 5), 16) * 587 + parseInt(colA.hex.slice(5, 7), 16) * 114) / 1000 > 128 ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)", fontSize: "11px", lineHeight: "14px", fontWeight: "bold" }}>✕</span> Stokje {colA.name}</span>

              <span><span style={{ display: "inline-block", width: "14px", height: "14px", background: colB.hex, border: "1px solid #ccc", verticalAlign: "middle", marginRight: "4px", borderRadius: "2px" }}></span> Vaste {colB.name}</span>

              <span><span style={{ display: "inline-block", width: "14px", height: "14px", background: colB.hex, border: "1px solid #ccc", verticalAlign: "middle", marginRight: "4px", borderRadius: "2px", textAlign: "center", color: (parseInt(colB.hex.slice(1, 3), 16) * 299 + parseInt(colB.hex.slice(3, 5), 16) * 587 + parseInt(colB.hex.slice(5, 7), 16) * 114) / 1000 > 128 ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)", fontSize: "11px", lineHeight: "14px", fontWeight: "bold" }}>✕</span> Stokje {colB.name}</span>
            </div>

            <div style={{ overflow: "auto", maxHeight: "70vh", background: B.white, borderRadius: "8px", padding: "16px", border: `1px solid ${B.beige}` }}>
              <ChartCanvas chart={chart} setChart={setChart} cellSize={cellSize} colA={colA} colB={colB} tool={tool} mode="edit" />
            </div>
          </div>
        )}

        {/* STEP 4: PATTERN */}
        {step === "pattern" && chart && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
              <h2 style={{ fontSize: "20px", color: B.darkGreen, margin: 0 }}>Geschreven haakpatroon</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setStep("edit")} style={btnSec}>← Editor</button>
                <button onClick={exportText} style={btnPri}>📄 Download .txt</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px" }}>
              <div>
                <div style={panelLabel}>Telpatroon</div>
                <div style={{ background: B.white, borderRadius: "8px", padding: "12px", border: `1px solid ${B.beige}`, marginBottom: "12px" }}>
                  <ChartCanvas chart={chart} setChart={setChart} cellSize={Math.max(2, Math.min(4, Math.floor(270 / Math.max(chart[0].length, chart.length))))} colA={colA} colB={colB} tool={tool} mode="view" />
                </div>
                <div style={panelLabel}>Visueel resultaat (benadering)</div>
                <div style={{ background: B.white, borderRadius: "8px", padding: "12px", border: `1px solid ${B.beige}`, marginBottom: "12px" }}>
                  <VisualPreview chart={chart} colA={colA} colB={colB} />
                </div>
                <div style={{ fontSize: "12px", color: "#666", background: B.white, borderRadius: "8px", padding: "12px", border: `1px solid ${B.beige}` }}>
                  <strong>{chart[0].length} × {chart.length}</strong> steken<br />
                  <strong>{colA.name}</strong> (A): oneven rijen<br />
                  <strong>{colB.name}</strong> (B): even rijen<br />
                  <strong>{stats.symbols}</strong> stokjes · <strong>{stats.plain}</strong> vastes<br />
                  <strong>{patternRows.length}</strong> rijen totaal
                </div>
              </div>

              <div style={{
                background: B.cream, border: `1px solid ${B.beige}`, borderRadius: "8px",
                padding: "16px", maxHeight: "80vh", overflowY: "auto",
                fontFamily: "'Courier New', monospace", fontSize: "10px", lineHeight: "1.5",
              }}>
                <div style={{ fontWeight: "bold", fontSize: "14px", color: B.orange, marginBottom: "4px", letterSpacing: "1px", fontFamily: "Georgia, serif" }}>
                  GESCHREVEN TEKST
                </div>
                <div style={{ fontFamily: "sans-serif", fontSize: "11px", color: "#666", lineHeight: 1.6, marginBottom: "12px", paddingBottom: "12px", borderBottom: `1px solid ${B.beige}` }}>
                  <strong>Kleuren:</strong> {colA.name} (A, oneven rijen) · {colB.name} (B, even rijen)<br />
                  <strong>v</strong> = vaste in achterste lus · <strong>stk</strong> = stokje in voorste lus 2 rijen lager · <strong>KS</strong> = kantsteek<br /><br />
                  Start met {colA.name}, lossenketting van {chart[0].length + 3} lossen, start in de 2e losse met in elke losse een v [{chart[0].length + 2}]. Hecht af.
                </div>
                {patternRows.map((r, i) => {
                  const rowNum = i + 1;
                  const colorIdx = getRowColor(rowNum - 1);
                  return (
                    <div key={i} style={{
                      padding: "3px 8px",
                      background: i % 2 === 0 ? "transparent" : B.beige,
                      borderRadius: "2px", marginBottom: "1px", wordBreak: "break-all",
                      borderLeft: `3px solid ${colorIdx === 0 ? colA.hex : colB.hex}`,
                    }}>{r}</div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================
// Utility Components
// ============================================================
function Steps({ current }) {
  const steps = [
    { id: "upload", l: "Upload" },
    { id: "adjust", l: "Conversie" },
    { id: "edit", l: "Bewerken" },
    { id: "pattern", l: "Patroon" },
  ];
  const idx = steps.findIndex(s => s.id === current);
  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
      {steps.map((s, i) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "4px",
            background: i === idx ? B.orange : i < idx ? B.lightGreen : "rgba(255,255,255,0.15)",
            borderRadius: "12px", padding: "3px 10px",
          }}>
            <span style={{ color: B.white, fontSize: "10px", fontWeight: 700 }}>{i + 1}</span>
            <span style={{ color: B.white, fontSize: "10px", display: i === idx ? "inline" : "none" }}>{s.l}</span>
          </div>
          {i < 3 && <div style={{ width: "12px", height: "1px", background: "rgba(255,255,255,0.25)" }} />}
        </div>
      ))}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div style={{ background: B.white, border: `1px solid ${B.beige}`, borderRadius: "8px", padding: "10px 14px" }}>
      <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: B.darkGreen, marginBottom: "6px" }}>{title}</div>
      {children}
    </div>
  );
}

function ColorPick({ label, color, set }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontSize: "9px", color: "#888" }}>{label}</span>
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <input type="color" value={color.hex} onChange={e => set({ ...color, hex: e.target.value })}
          style={{ width: "26px", height: "26px", border: "none", borderRadius: "5px", cursor: "pointer", padding: 0 }} />
        <input type="text" value={color.name} onChange={e => set({ ...color, name: e.target.value })}
          style={{ ...inp, width: "80px", fontSize: "11px" }} placeholder="Naam" />
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================
const panelLabel = { fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: B.darkGreen, marginBottom: "8px" };
const lbl = { fontSize: "12px", fontWeight: 600, color: B.brown };
const inp = { width: "55px", padding: "4px 6px", border: `1px solid ${B.beige}`, borderRadius: "5px", fontSize: "12px", background: B.cream, outline: "none", textAlign: "center" };
const btnPri = { background: `linear-gradient(135deg, ${B.orange}, ${B.orangeLight})`, color: B.white, border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "14px", fontWeight: 700, cursor: "pointer", boxShadow: `0 3px 12px ${B.orange}40` };
const btnSec = { background: B.white, color: B.dark, border: `1px solid ${B.beige}`, borderRadius: "8px", padding: "10px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer" };
const btnTool = { border: "1.5px solid", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const btnSm = { background: "transparent", border: `1px solid ${B.beige}`, borderRadius: "5px", padding: "4px 8px", fontSize: "11px", cursor: "pointer", color: B.brown, whiteSpace: "nowrap" };
