import { useState, useCallback, useRef, useEffect } from "react";
import { supabase, hasSupabaseConfig } from "./lib/supabaseClient";

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

function withinRestoreWindow(chart) {
  return !!(chart?.isDeleted && chart?.deletedAt && (Date.now() - new Date(chart.deletedAt).getTime() <= ONE_WEEK_MS));
}

/*
  OVERLAY MOSAIC CROCHET LOGIC:
  
  TWO CHARTS:
  1. DESIGN CHART — the visual result the user wants. true = dark color visible.
     Dark cells can be adjacent vertically — it's just a picture.
  2. STITCH CHART — derived from the design. true = DC (stokje), false = SC (vaste).
     Here the no-stacking rule applies: no two DCs directly above each other.
  
  HOW OVERLAY MOSAIC WORKS:
  - Rows alternate color: row 1 = A (light), row 2 = B (dark), row 3 = A, ...
  - Every stitch on a row is worked in that row's color.
  - SC (vaste) goes in the back loop of the previous row.
  - DC (stokje) goes in the front loop of the same-color row below (2 rows down).
  - A DC on row N covers/overlays row N-1 at that position.
  - Without a DC from above, each position shows its own row's natural color.
  
  DERIVING STITCHES FROM DESIGN:
  Position (x) on row N shows:
    - Row N's color IF there is no DC on row N+1 at position x
    - Row N+1's color IF there IS a DC on row N+1 at position x (the DC overlays)
  
  So to achieve design[row N][x]:
    - If design wants the SAME color as row N's natural color → no DC needed on row N+1
    - If design wants a DIFFERENT color → DC needed on row N+1
  
  In array terms (y=0 = top = highest row number, y=h-1 = bottom = row 1):
    rowNum(y) = h - y
    isRowDark(y) = (rowNum % 2 === 0)  // even rows = B = dark
    
    For design position y (which is covered by row y-1 in the array):
      needDC at [y-1][x] = (design[y][x] !== isRowDark(y))
*/

const createEmptyChart = (w, h) =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => false));

const withAlpha = (hex, alpha = "70") => {
  if (typeof hex !== "string") return hex;
  if (hex.startsWith("#") && hex.length === 7) return `${hex}${alpha}`;
  return hex;
};

// Get row color: row 0 (bottom) = A, row 1 = B...
const getRowColor = (rowIdx) => (rowIdx % 2 === 0 ? 0 : 1); // 0=A(light), 1=B(dark)

// Is row at array index y a "dark" row (color B)?
const isRowDark = (y, h) => ((h - y) % 2 === 0);

// Derive stitch chart from visual design
// Returns a 2D boolean array: true = DC (stokje), false = SC (vaste)
function deriveStitchChart(design) {
  const h = design.length, w = design[0].length;
  const stitches = Array.from({ length: h }, () => Array.from({ length: w }, () => false));
  
  // For each design position (y, x):
  // The visible color at (y, x) is determined by whether the row above (y-1) has a DC.
  // A DC on row y-1 makes position (y, x) show row y-1's color instead of row y's color.
  // 
  // We want: design[y][x] = true → dark color visible
  //          design[y][x] = false → light color visible
  //
  // If the design differs from the natural row color, we need a DC from the row above.
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wantDark = design[y][x];
      const rowIsDark = isRowDark(y, h);
      if (wantDark !== rowIsDark) {
        // Need a DC on the row above (y-1) to override the natural color
        stitches[y - 1][x] = true;
      }
    }
  }
  return stitches;
}

// ============================================================
// Image to Chart Conversion — stores visual design (not stitches)
// ============================================================
function imageToChart(img, targetW, targetH, threshold) {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, targetW, targetH);
  const data = ctx.getImageData(0, 0, targetW, targetH).data;

  const chart = [];
  for (let y = 0; y < targetH; y++) {
    const row = [];
    for (let x = 0; x < targetW; x++) {
      const i = (y * targetW + x) * 4;
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      row.push(gray < threshold); // true = dark pixel = design wants dark color here
    }
    chart.push(row);
  }
  return { chart, fixes: 0 };
}

// ============================================================
// Pattern Generation
// ============================================================
// ============================================================
// Pattern Generation — derives stitches from visual design
// ============================================================
function generateWrittenPattern(design, colA, colB, direction = "RtoL") {
  const h = design.length, w = design[0].length;
  const stitchChart = deriveStitchChart(design);
  const rows = [];

  for (let rowNum = 1; rowNum <= h; rowNum++) {
    const chartY = h - rowNum; // array index for this crochet row
    const colorIdx = getRowColor(rowNum - 1);
    const colorName = colorIdx === 0 ? colA.name : colB.name;

    const indices = [];
    if (direction === "RtoL") {
      for (let x = w - 1; x >= 0; x--) indices.push(x);
    } else {
      for (let x = 0; x < w; x++) indices.push(x);
    }

    const stitches = [];
    let curType = null, count = 0;

    for (let x of indices) {
      const hasStokje = stitchChart[chartY][x];
      const stType = hasStokje ? "stk" : "v";

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

    // Helper: draw a single cell — uses function declaration for hoisting within this scope
    function drawCell(vx, vy, size, color, content, symbolColor) {
      ctx.fillStyle = color;
      ctx.fillRect(vx * size, vy * size, size, size);
      if (!content) return;

      ctx.strokeStyle = symbolColor;
      ctx.lineWidth = Math.max(1, size * 0.14);
      const cx = vx * size + size / 2;
      const cy = vy * size + size / 2;
      const p = size * 0.25;
      const l = vx * size + p;
      const r = (vx + 1) * size - p;
      const t = vy * size + p;
      const b = (vy + 1) * size - p;

      if (content === "DC") {
        if (size < 6) {
          const pSmall = Math.max(0.8, size * 0.22);
          const lSmall = vx * size + pSmall;
          const rSmall = (vx + 1) * size - pSmall;
          const tSmall = vy * size + pSmall;
          const bSmall = (vy + 1) * size - pSmall;
          ctx.beginPath();
          ctx.moveTo(lSmall, tSmall); ctx.lineTo(rSmall, bSmall);
          ctx.moveTo(rSmall, tSmall); ctx.lineTo(lSmall, bSmall);
          ctx.stroke();
          return;
        }
        ctx.beginPath();
        ctx.moveTo(l, t); ctx.lineTo(r, b);
        ctx.moveTo(r, t); ctx.lineTo(l, b);
        ctx.stroke();
      } else if (content === "KS") {
        ctx.fillStyle = symbolColor;
        ctx.beginPath(); ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    const colAHex = colA.hex;
    const colBHex = colB.hex;

    // --- Draw Grid & Design ---
    // The chart stores the VISUAL DESIGN: true = dark color visible, false = light color
    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const colorIdx = getRowColor(rowNum - 1);
      const rowColor = colorIdx === 0 ? colAHex : colBHex;

      // 1. Draw Edges (kantsteek) — always in row color
      if (config.showEdges) {
        drawCell(0, y, cellSize, rowColor, "KS", "#fff");
        drawCell(totalW - 1, y, cellSize, rowColor, "KS", "#fff");
      }

      // 2. Draw design cells — dark in colB, light in colA (with transparency)
      for (let x = 0; x < w; x++) {
        const visualX = xOffset + x;
        const designIsDark = chart[y][x];
        const bg = designIsDark ? colBHex : withAlpha(colAHex, "40");
        drawCell(visualX, y, cellSize, bg, null, null);
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
    if (tool === "symbol") {
      g[y][x] = true;  // dark
    } else if (tool === "erase") {
      g[y][x] = false;  // light
    } else {
      g[y][x] = !g[y][x];  // toggle
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

    // The chart IS the visual design: true = dark color, false = light color
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        ctx.fillStyle = chart[y][x] ? colB.hex : colA.hex;
        ctx.fillRect(x * s, y * s, s, s);
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
    const record = buildCurrentChartRecord();
    if (!record) {
      alert("Er is nog geen teltekening om op te slaan.");
      return;
    }
    upsertSavedChart(record);
    setCurrentChartId(record.id);
    setChartTitle(record.title);
    setChartFolderId(record.folderId);
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
    setChart(Array.isArray(nextRecord.chart) ? nextRecord.chart.map(r => [...r]) : null);
    setCellSize(nextRecord.cellSize || 4);
    setColA(nextRecord.colA || { name: "Zandvoort", hex: "#E8DCC8" });
    setColB(nextRecord.colB || { name: "Arnhem", hex: "#C75050" });
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

  const signInWithGitHub = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin },
    });
    if (error) alert("Inloggen via GitHub is mislukt.");
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
      // Edge columns in a neutral color
      if (projConfig.showEdges) {
        ctx.fillStyle = "#ccc";
        ctx.fillRect(0, y * s, s, s);
        ctx.fillRect((totalCols - 1) * s, y * s, s, s);
      }

      for (let x = 0; x < gridW; x++) {
        // Design: dark cells in colB, light cells in colA
        ctx.fillStyle = preview[y][x] ? colB.hex : colA.hex;
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
    dark: chart.flat().filter(c => c).length,
    light: chart.flat().filter(c => !c).length,
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
                else signInWithGitHub();
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
    <div style={{ minHeight: "100vh", background: B.white, fontFamily: F.body, color: B.dark }}>
      <style>{BRAND_FONT_FACE_CSS}</style>
      <header style={{ background: B.white, position: "sticky", top: 0, zIndex: 100, borderBottom: `1px solid ${B.border}` }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: B.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: B.white, fontWeight: 700 }}>YZ</div>
            <div>
              <span style={{ color: B.orange, fontWeight: 700, fontSize: "22px", fontFamily: F.heading, lineHeight: 1 }}>YarnZoo</span>
              <span style={{ color: "#7A7780", fontSize: "9px", letterSpacing: "1.4px", textTransform: "uppercase", marginLeft: "8px" }}>Mosaic Studio</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <span style={{ color: B.dark, fontSize: "11px", maxWidth: isMobile ? "130px" : "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", border: `1px solid ${B.border}`, borderRadius: "6px", padding: "5px 8px", background: "#FCFCFC" }}>
              {chartTitle}
            </span>
            {isMobile && (
              <button style={btnHead} onClick={() => setSidebarOpen(true)}>Menu</button>
            )}
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
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "280px minmax(0, 1fr)", gap: "16px", alignItems: "start" }}>
          {!isMobile && (
            <aside style={sidebarWrap}>
              {sidebarContent}
            </aside>
          )}
          <section style={{ minWidth: 0 }}>

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
                return (
                  <div key={saved.id} style={{ border: `1px solid ${B.beige}`, borderRadius: "6px", padding: "8px", display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "12px", color: "#555" }}>
                      <strong style={{ color: B.dark }}>{saved.title || "Naamloze chart"}</strong><br />
                      {saved.gridW} × {saved.gridH} patroon · map: {findFolderName(saved.folderId)} · {deletedLabel}
                    </div>
                    <button style={btnSm} onClick={() => openSavedChart(saved)}>
                      {saved.isDeleted ? "Herstel + open" : "Open"}
                    </button>
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
          <div>
            <h2 style={{ fontSize: "28px", color: B.orange, marginBottom: "16px", fontFamily: F.heading, fontWeight: 700 }}>Pas de conversie aan</h2>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "24px" }}>
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

                  <div style={{ fontSize: "10px", fontWeight: 700, color: B.orange, textTransform: "uppercase", letterSpacing: "1px" }}>
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

                  <div style={{ fontSize: "10px", fontWeight: 700, color: B.orange, textTransform: "uppercase", letterSpacing: "1px" }}>
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
              <h2 style={{ fontSize: "28px", color: B.orange, margin: 0, fontFamily: F.heading, fontWeight: 700 }}>Bewerk je telpatroon</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setStep("adjust")} style={btnSec}>← Conversie</button>
                <button onClick={() => setStep("pattern")} style={btnPri}>Bekijk patroon →</button>
              </div>
            </div>

            {false && (
              <div style={{ background: B.cream, border: `1px solid ${B.orange}`, borderRadius: "6px", padding: "10px 16px", marginBottom: "12px", fontSize: "13px" }}>
                Let op: <strong>{fixCount}</strong> stokjes zijn automatisch verwijderd (stokje-op-stokje regel). Controleer het resultaat.
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
                    { id: "symbol", icon: "D", l: "Donker" },
                    { id: "erase", icon: "L", l: "Licht" },
                    { id: "toggle", icon: "T", l: "Wissel" },
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
              <span><span style={{ display: "inline-block", width: "12px", height: "12px", background: colA.hex + "40", border: "1px solid #ccc", verticalAlign: "middle", marginRight: "4px" }}></span> Licht ({colA.name})</span>
              <span><span style={{ display: "inline-block", width: "12px", height: "12px", background: colB.hex, border: "1px solid #ccc", verticalAlign: "middle", marginRight: "4px" }}></span> Donker ({colB.name})</span>
              {projConfig.showEdges && <span><span style={{ display: "inline-block", width: "12px", height: "12px", background: "#eee", border: "1px solid #ccc", verticalAlign: "middle", marginRight: "4px", borderRadius: "50%", textAlign: "center", fontSize: "8px", lineHeight: "12px" }}>●</span> Kantsteek</span>}
            </div>

            <div style={{ overflow: "auto", maxHeight: "70vh", background: B.white, borderRadius: "6px", padding: "16px", border: `1px solid ${B.beige}` }}>
              <ChartCanvas chart={chart} setChart={setChart} cellSize={cellSize} colA={colA} colB={colB} tool={tool} mode="edit" config={projConfig} />
            </div>
          </div>
        )}

        {step === "pattern" && chart && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
              <h2 style={{ fontSize: "28px", color: B.orange, margin: 0, fontFamily: F.heading, fontWeight: 700 }}>Geschreven haakpatroon</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setStep("edit")} style={btnSec}>← Editor</button>
                <button onClick={exportText} style={btnPri}>Download .txt</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "300px 1fr", gap: "20px" }}>
              <div>
                <div style={panelLabel}>Telpatroon</div>
                <div style={{ background: B.white, borderRadius: "6px", padding: "12px", border: `1px solid ${B.beige}`, marginBottom: "12px" }}>
                  <ChartCanvas chart={chart} setChart={setChart} cellSize={Math.max(2, Math.min(4, Math.floor(270 / Math.max(chart[0].length, chart.length))))} colA={colA} colB={colB} tool={tool} mode="view" config={projConfig} />
                </div>
                <div style={panelLabel}>Visueel resultaat (benadering)</div>
                <div style={{ background: B.white, borderRadius: "6px", padding: "12px", border: `1px solid ${B.beige}`, marginBottom: "12px" }}>
                  <VisualPreview chart={chart} colA={colA} colB={colB} />
                </div>
              </div>

              <div style={{
                background: B.cream, border: `1px solid ${B.beige}`, borderRadius: "6px",
                padding: "16px", maxHeight: "80vh", overflowY: "auto",
                fontFamily: F.mono, fontSize: "11px", lineHeight: "1.5",
              }}>
                <div style={{ fontWeight: 700, fontSize: "24px", color: B.orange, marginBottom: "4px", letterSpacing: "0.02em", fontFamily: F.heading }}>
                  GESCHREVEN TEKST
                </div>
                <div style={{ fontFamily: F.body, fontSize: "11px", color: "#666", lineHeight: 1.6, marginBottom: "12px", paddingBottom: "12px", borderBottom: `1px solid ${B.beige}` }}>
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
          </section>
        </div>
      </main>
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

function ColorPick({ label, color, set }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontSize: "9px", color: "#888" }}>{label}</span>
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <input type="color" value={color.hex} onChange={e => set({ ...color, hex: e.target.value })}
          style={{ width: "26px", height: "26px", border: "none", borderRadius: "6px", cursor: "pointer", padding: 0 }} />
        <input type="text" value={color.name} onChange={e => set({ ...color, name: e.target.value })}
          style={{ ...inp, width: "80px", fontSize: "11px" }} placeholder="Naam" />
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
