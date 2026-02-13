import { useState, useCallback, useRef, useEffect } from "react";

// ============================================================
// YARNZOO MOSAIC STUDIO v0.3.1 — Edge Stitches & RtoL Config
// ============================================================

const B = {
  orange: "#F5921B", orangeLight: "#F7A63E",
  darkGreen: "#2D5A27", lightGreen: "#4A8C3F",
  cream: "#FAF7F2", beige: "#EDE8DF",
  brown: "#5C4033", dark: "#2A2A2A", white: "#FFFFFF",
};

/*
  OVERLAY MOSAIC CROCHET LOGIC:
  - Rows alternate color: row 1 = color A, row 2 = color B...
  - Validate no stacking: A symbol cannot be directly above another symbol.
*/

const createEmptyChart = (w, h) =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => false));

// Get row color: row 0 (bottom) = A, row 1 = B...
const getRowColor = (rowIdx) => (rowIdx % 2 === 0 ? 0 : 1); // 0=A, 1=B

// Validate no-stacking rule
function validateNoStacking(chart) {
  const h = chart.length, w = chart[0].length;
  const fixed = chart.map(r => [...r]);
  let fixes = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      if (fixed[y][x] && fixed[y + 1][x]) {
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

  // First pass: determine which pixels are "dark"
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
  const chart = raw.map(row => row.map(dark => dark));
  return validateNoStacking(chart);
}

// ============================================================
// Pattern Generation
// ============================================================
function generateWrittenPattern(chart, colA, colB, direction = "RtoL") {
  const h = chart.length, w = chart[0].length;
  const rows = [];

  for (let rowNum = 1; rowNum <= h; rowNum++) {
    // Row 1 is bottom of chart = chart[h-1]
    const chartY = h - rowNum;
    const colorIdx = getRowColor(rowNum - 1);
    const colorName = colorIdx === 0 ? colA.name : colB.name;

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
function ChartCanvas({ chart, setChart, cellSize, colA, colB, tool, mode, config = { direction: "RtoL", showEdges: true } }) {
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

    const colAHex = colA.hex;
    const colBHex = colB.hex;

    // --- Draw Grid & Stitches ---
    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowColor = colorIdx === 0 ? colAHex : colBHex;
      const rowColorLight = colorIdx === 0 ? colAHex + "40" : colBHex + "40";
      const symbolColor = "#fff";

      // 1. Draw Edges
      if (config.showEdges) {
        // Left Column (End KS if RtoL)
        drawCell(ctx, 0, y, cellSize, rowColor, "KS", symbolColor);
        // Right Column (Start KS if RtoL)
        drawCell(ctx, totalW - 1, y, cellSize, rowColor, "KS", symbolColor);
      }

      // 2. Draw Pattern
      for (let x = 0; x < w; x++) {
        const visualX = xOffset + x;
        const hasSymbol = chart[y][x];
        const bg = hasSymbol ? rowColor : rowColorLight;

        drawCell(ctx, visualX, y, cellSize, bg, hasSymbol ? "DC" : null, symbolColor);
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

  // Helper
  const drawCell = (ctx, vx, vy, size, color, content, symbolColor) => {
    ctx.fillStyle = color;
    ctx.fillRect(vx * size, vy * size, size, size);
    if (!content || size < 6) return;

    ctx.strokeStyle = symbolColor;
    ctx.lineWidth = Math.max(1, size * 0.12);
    const cx = vx * size + size / 2;
    const cy = vy * size + size / 2;
    const p = size * 0.25;
    const l = vx * size + p;
    const r = (vx + 1) * size - p;
    const t = vy * size + p;
    const b = (vy + 1) * size - p;

    if (content === "DC") {
      ctx.beginPath();
      ctx.moveTo(l, t); ctx.lineTo(r, b);
      ctx.moveTo(r, t); ctx.lineTo(l, b);
      ctx.stroke();
    } else if (content === "KS") {
      ctx.fillStyle = symbolColor;
      // Draw a distinct dot for edge
      ctx.beginPath(); ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2); ctx.fill();
    }
  };

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
    if (tool === "symbol") {
      g[y][x] = true;
    } else if (tool === "erase") {
      g[y][x] = false;
    } else {
      g[y][x] = !g[y][x];
    }
    if (g[y][x]) {
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

    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowHex = colorIdx === 0 ? colA.hex : colB.hex;

      for (let x = 0; x < w; x++) {
        ctx.fillStyle = rowHex;
        ctx.fillRect(x * s, y * s, s, s);
      }
    }

    // Overlay pass
    for (let y = 0; y < h - 1; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowHex = colorIdx === 0 ? colA.hex : colB.hex;
      for (let x = 0; x < w; x++) {
        if (chart[y][x]) {
          ctx.fillStyle = rowHex;
          ctx.fillRect(x * s, (y + 1) * s, s, s);
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
  const [calcUnit, setCalcUnit] = useState("cm");
  const [calcIncludesEdges, setCalcIncludesEdges] = useState(true);
  const [syncCalculatorToGrid, setSyncCalculatorToGrid] = useState(true);
  const [swatchWidth, setSwatchWidth] = useState(10);
  const [swatchHeight, setSwatchHeight] = useState(10);
  const [swatchStitches, setSwatchStitches] = useState(28);
  const [swatchRows, setSwatchRows] = useState(28);
  const [desiredWidth, setDesiredWidth] = useState(35);
  const [desiredHeight, setDesiredHeight] = useState(45);

  // Project Settings
  const [projConfig, setProjConfig] = useState({
    direction: "RtoL", // "RtoL" | "LtoR"
    showEdges: true,
  });

  const previewRef = useRef(null);

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
      const rowHexLight = colorIdx === 0 ? colA.hex + "50" : colB.hex + "50";

      if (projConfig.showEdges) {
        ctx.fillStyle = rowHex;
        ctx.fillRect(0, y * s, s, s);
        ctx.fillRect((totalCols - 1) * s, y * s, s, s);
      }

      for (let x = 0; x < gridW; x++) {
        ctx.fillStyle = preview[y][x] ? rowHex : rowHexLight;
        ctx.fillRect((xOffset + x) * s, y * s, s, s);
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

  const patternRows = chart ? generateWrittenPattern(chart, colA, colB, projConfig.direction) : [];

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

  const goToStep = (nextStep) => {
    if (!canGoToStep[nextStep]) return;
    setStep(nextStep);
  };

  const exportText = () => {
    const hdr = [
      `HAAKPATROON — Overlay Mozaiek`,
      `Afmetingen: ${gridW} steken breed x ${gridH} rijen hoog`,
      `Telrichting: ${projConfig.direction === "RtoL" ? "Rechts naar Links (←)" : "Links naar Rechts (→)"}`,
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
      <header style={{ background: B.darkGreen, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 20px rgba(0,0,0,0.15)" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: B.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🐒</div>
            <div>
              <span style={{ color: B.orange, fontWeight: 800, fontSize: "18px" }}>YarnZoo</span>
              <span style={{ color: B.lightGreen, fontSize: "9px", letterSpacing: "2px", textTransform: "uppercase", marginLeft: "8px" }}>Mosaic Studio v0.3</span>
            </div>
          </div>
          <Steps current={step} onSelect={goToStep} canGoToStep={canGoToStep} />
        </div>
        <div style={{ height: "3px", background: `linear-gradient(90deg, ${B.lightGreen}, ${B.orange}, ${B.lightGreen})` }} />
      </header>

      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>

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
                <div style={panelLabel}>Telpatroon preview ({projConfig.showEdges ? gridW + 2 : gridW} × {gridH})</div>
                <div style={{ background: B.white, borderRadius: "8px", padding: "12px", border: `1px solid ${B.beige}`, textAlign: "center" }}>
                  <canvas ref={previewRef} style={{ maxWidth: "100%", imageRendering: "pixelated", borderRadius: "4px" }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "20px" }}>
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

              <Panel title="Chart Size Calculator">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "330px" }}>
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

                  <div style={{ fontSize: "10px", fontWeight: 700, color: B.darkGreen, textTransform: "uppercase", letterSpacing: "1px" }}>
                    Sample swatch
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
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

                  <div style={{ fontSize: "10px", fontWeight: 700, color: B.darkGreen, textTransform: "uppercase", letterSpacing: "1px" }}>
                    Gewenste eindmaat
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={lbl}>Maat:</span>
                    <input type="number" min="0" step="0.1" value={desiredWidth} onChange={e => { setSyncCalculatorToGrid(true); setDesiredWidth(Math.max(0, parseFloat(e.target.value) || 0)); }} style={inp} />
                    <span style={{ fontSize: "11px", color: "#777" }}>×</span>
                    <input type="number" min="0" step="0.1" value={desiredHeight} onChange={e => { setSyncCalculatorToGrid(true); setDesiredHeight(Math.max(0, parseFloat(e.target.value) || 0)); }} style={inp} />
                    <span style={{ fontSize: "11px", color: "#777" }}>{calcUnit}</span>
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
                      color: calculatorResult ? B.darkGreen : "#999",
                      borderColor: calculatorResult ? B.lightGreen : B.beige,
                      background: calculatorResult ? "#F3FAF1" : "#F8F8F8",
                      cursor: calculatorResult ? "pointer" : "not-allowed",
                    }}
                  >
                    Gebruik berekende afmetingen ({calculatorResult ? `${calculatorResult.targetTotalColumns} × ${calculatorResult.calculatedRows}` : "-"})
                  </button>
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
              <Panel title="Project Instellingen">
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
                    <input type="checkbox" checked={projConfig.showEdges} onChange={e => setProjConfig({ ...projConfig, showEdges: e.target.checked })} />
                    Toon Kantsteken
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
                    <select value={projConfig.direction} onChange={e => setProjConfig({ ...projConfig, direction: e.target.value })} style={{ ...inp, width: "auto" }}>
                      <option value="RtoL">Start Rechts (←)</option>
                      <option value="LtoR">Start Links (→)</option>
                    </select>
                  </label>
                </div>
              </Panel>

              <Panel title="Gereedschap">
                <div style={{ display: "flex", gap: "4px" }}>
                  {[
                    { id: "symbol", icon: "✏️", l: "Stokje" },
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
                  <button onClick={() => setChart(chart.map(r => r.map(c => !c)))} style={btnSm}>◐ Omkeren</button>
                  <button onClick={() => setChart(chart.map(r => [...r].reverse()))} style={btnSm}>↔ Spiegel H</button>
                  <button onClick={() => setChart([...chart].reverse())} style={btnSm}>↕ Spiegel V</button>
                  <button onClick={() => { const { chart: c, fixes } = validateNoStacking(chart); setChart(c); if (fixes > 0) alert(`${fixes} errors solved.`); else alert("Valid!"); }} style={btnSm}>✓ Check</button>
                </div>
              </Panel>
              <Panel title="Zoom">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input type="range" min={2} max={18} value={cellSize} onChange={e => setCellSize(parseInt(e.target.value))} style={{ width: "80px" }} />
                </div>
              </Panel>
              <Panel title="Raster grootte">
                <div style={{ fontSize: "11px", color: "#666", lineHeight: 1.5 }}>
                  <strong>{projConfig.showEdges ? gridW + 2 : gridW}</strong> kolommen × <strong>{gridH}</strong> rijen<br />
                  <strong>{((projConfig.showEdges ? gridW + 2 : gridW) * gridH).toLocaleString("nl-NL")}</strong> totaal steken
                  {projConfig.showEdges && <><br />({gridW} patroon + 2 kantsteken)</>}
                </div>
              </Panel>
            </div>

            <div style={{ display: "flex", gap: "16px", marginBottom: "12px", fontSize: "11px", color: "#666", flexWrap: "wrap", alignItems: "center" }}>
              <span><span style={{ display: "inline-block", width: "12px", height: "12px", background: colA.hex + "50", border: "1px solid #ccc", verticalAlign: "middle", marginRight: "4px" }}></span> Vaste {colA.name}</span>
              <span><span style={{ display: "inline-block", width: "12px", height: "12px", background: colA.hex, border: "1px solid #ccc", verticalAlign: "middle", marginRight: "4px", textAlign: "center", color: "#fff", fontSize: "8px", lineHeight: "12px" }}>✕</span> Stokje {colA.name}</span>
              <span><span style={{ display: "inline-block", width: "12px", height: "12px", background: colB.hex + "50", border: "1px solid #ccc", verticalAlign: "middle", marginRight: "4px" }}></span> Vaste {colB.name}</span>
              <span><span style={{ display: "inline-block", width: "12px", height: "12px", background: colB.hex, border: "1px solid #ccc", verticalAlign: "middle", marginRight: "4px", textAlign: "center", color: "#fff", fontSize: "8px", lineHeight: "12px" }}>✕</span> Stokje {colB.name}</span>
              {projConfig.showEdges && <span><span style={{ display: "inline-block", width: "12px", height: "12px", background: "#eee", border: "1px solid #ccc", verticalAlign: "middle", marginRight: "4px", borderRadius: "50%", textAlign: "center", fontSize: "8px", lineHeight: "12px" }}>●</span> Kantsteek</span>}
            </div>

            <div style={{ overflow: "auto", maxHeight: "70vh", background: B.white, borderRadius: "8px", padding: "16px", border: `1px solid ${B.beige}` }}>
              <ChartCanvas chart={chart} setChart={setChart} cellSize={cellSize} colA={colA} colB={colB} tool={tool} mode="edit" config={projConfig} />
            </div>
          </div>
        )}

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
                  <ChartCanvas chart={chart} setChart={setChart} cellSize={Math.max(2, Math.min(4, Math.floor(270 / Math.max(chart[0].length, chart.length))))} colA={colA} colB={colB} tool={tool} mode="view" config={projConfig} />
                </div>
                <div style={panelLabel}>Visueel resultaat (benadering)</div>
                <div style={{ background: B.white, borderRadius: "8px", padding: "12px", border: `1px solid ${B.beige}`, marginBottom: "12px" }}>
                  <VisualPreview chart={chart} colA={colA} colB={colB} />
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
                  <strong>Richting:</strong> {projConfig.direction === "RtoL" ? "Begin Rechts (←)" : "Begin Links (→)"}<br /><br />
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

function Steps({ current, onSelect, canGoToStep }) {
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
          <button
            onClick={() => onSelect?.(s.id)}
            disabled={!canGoToStep?.[s.id]}
            style={{
              display: "flex", alignItems: "center", gap: "4px",
              background: i === idx ? B.orange : i < idx ? B.lightGreen : "rgba(255,255,255,0.15)",
              borderRadius: "12px", padding: "3px 10px", border: "none",
              opacity: canGoToStep?.[s.id] ? 1 : 0.55,
              cursor: canGoToStep?.[s.id] ? "pointer" : "not-allowed",
            }}
            title={canGoToStep?.[s.id] ? `Ga naar ${s.l}` : `${s.l} is nog niet beschikbaar`}
          >
            <span style={{ color: B.white, fontSize: "10px", fontWeight: 700 }}>{i + 1}</span>
            <span style={{ color: B.white, fontSize: "10px", display: i === idx ? "inline" : "none" }}>{s.l}</span>
          </button>
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

const panelLabel = { fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: B.darkGreen, marginBottom: "8px" };
const lbl = { fontSize: "12px", fontWeight: 600, color: B.brown };
const inp = { width: "55px", padding: "4px 6px", border: `1px solid ${B.beige}`, borderRadius: "5px", fontSize: "12px", background: B.cream, outline: "none", textAlign: "center" };
const btnPri = { background: `linear-gradient(135deg, ${B.orange}, ${B.orangeLight})`, color: B.white, border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "14px", fontWeight: 700, cursor: "pointer", boxShadow: `0 3px 12px ${B.orange}40` };
const btnSec = { background: B.white, color: B.dark, border: `1px solid ${B.beige}`, borderRadius: "8px", padding: "10px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer" };
const btnTool = { border: "1.5px solid", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const btnSm = { background: "transparent", border: `1px solid ${B.beige}`, borderRadius: "5px", padding: "4px 8px", fontSize: "11px", cursor: "pointer", color: B.brown, whiteSpace: "nowrap" };
