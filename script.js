// =============================================================================
// Battlebucks Simulator — UI Logic
// =============================================================================

// ---- DOM References ----
// const btnSetupPlayers = document.getElementById('btn-setup-players');
// const btnBackConfig   = document.getElementById('btn-back-config');
const totalPlayersInput = document.getElementById('totalPlayers');
const btnCompute      = document.getElementById('btn-compute');
// const btnReset        = document.getElementById('btn-reset');
const preset2p        = document.getElementById('preset2p');
const preset6p        = document.getElementById('preset6p');
const playersGrid     = document.getElementById('players-grid');
const playerCountLabel = document.getElementById('player-count-label');
// const stepConfig      = document.getElementById('step-config');
// const stepPlayers     = document.getElementById('step-players');
// const stepResults     = document.getElementById('step-results');
const resultsTbody    = document.getElementById('results-tbody');
const resultsSummary  = document.getElementById('results-summary');
const tooltipBox      = document.getElementById('tooltip-box');
const btnCopyJson    = document.getElementById('btn-copy-json');
const btnDownloadPdf = document.getElementById('btn-download-pdf');

// ---- State ----
let currentTotalPlayers = 6;
let lastExportPayload = null;
buildPlayerInputs(parseInt(totalPlayersInput.value));
totalPlayersInput.addEventListener('input', () => {
  const total = parseInt(totalPlayersInput.value);
  if (!isNaN(total) && total >= 2 && total <= 12) {
    currentTotalPlayers = total;
    buildPlayerInputs(total);
    playerCountLabel.textContent = `${total} Players`;
  }
});

// ---- Tooltip Logic ----
document.querySelectorAll('.tooltip-trigger').forEach(el => {
  el.addEventListener('mouseenter', (e) => {
    tooltipBox.textContent = el.dataset.tip;
    tooltipBox.classList.add('visible');
  });
  el.addEventListener('mousemove', (e) => {
    tooltipBox.style.left = (e.clientX + 14) + 'px';
    tooltipBox.style.top  = (e.clientY - 10) + 'px';
  });
  el.addEventListener('mouseleave', () => {
    tooltipBox.classList.remove('visible');
  });
});

// ---- Preset Buttons ----
preset2p.addEventListener('click', () => applyPreset({
  maxPos: 8, midPos: 6, lowPos: 3,
  lowNeg: -2, midNeg: -4, maxNeg: -6
}));

preset6p.addEventListener('click', () => applyPreset({
  maxPos: 40, midPos: 25, lowPos: 10,
  lowNeg: -10, midNeg: -25, maxNeg: -40
}));

function applyPreset(config) {
  document.getElementById('maxPos').value = config.maxPos;
  document.getElementById('midPos').value = config.midPos;
  document.getElementById('lowPos').value = config.lowPos;
  document.getElementById('lowNeg').value = config.lowNeg;
  document.getElementById('midNeg').value = config.midNeg;
  document.getElementById('maxNeg').value = config.maxNeg;

  // Pulse animation on trophy inputs
  ['maxPos','midPos','lowPos','lowNeg','midNeg','maxNeg'].forEach(id => {
    const el = document.getElementById(id);
    el.style.transition = 'border-color 0.1s';
    el.style.borderColor = '#f59e0b';
    setTimeout(() => { el.style.borderColor = ''; }, 600);
  });
}

// ---- Step 1 → Step 2: Build Player Inputs ----
// btnSetupPlayers.addEventListener('click', () => {
//   const total = parseInt(document.getElementById('totalPlayers').value);

//   if (isNaN(total) || total < 2 || total > 12) {
//     showError(stepConfig, 'Total Players must be between 2 and 12.');
//     return;
//   }

//   clearErrors();
//   currentTotalPlayers = total;
//   buildPlayerInputs(total);

//   stepConfig.classList.add('hidden');
//   stepPlayers.classList.remove('hidden');
//   stepPlayers.classList.add('animate-in');
//   window.scrollTo({ top: stepPlayers.offsetTop - 80, behavior: 'smooth' });
// });

// ---- Step 2 → Step 1: Back ----
// btnBackConfig.addEventListener('click', () => {
//   stepPlayers.classList.add('hidden');
//   stepConfig.classList.remove('hidden');
//   stepConfig.classList.add('animate-in');
//   window.scrollTo({ top: 0, behavior: 'smooth' });
// });

// ---- Build Player Input Cards ----
function buildPlayerInputs(total) {
  playersGrid.innerHTML = '';
  playerCountLabel.textContent = `${total} Players`;

  for (let i = 1; i <= total; i++) {
    const initials = `P${i}`;
    const card = document.createElement('div');
    card.className = 'player-card';
    card.style.animationDelay = `${(i - 1) * 0.05}s`;
    card.classList.add('animate-in');
    card.innerHTML = `
      <div class="player-card-header">
        <div class="player-avatar">${initials}</div>
        <div class="player-name">Player ${i}</div>
      </div>
      <div class="player-fields">
        <div class="input-group">
          <label>Current Elo</label>
          <input type="number" id="elo-${i}" value="1500" min="0" max="10000" placeholder="e.g. 1500" />
        </div>
        <div class="input-group">
          <label>Current Trophies</label>
          <input type="number" id="trophies-${i}" value="800" min="0" placeholder="e.g. 800" />
        </div>
        <div class="input-group">
          <label>Match Score <span class="hint">(higher = better finish)</span></label>
          <input type="number" id="score-${i}" value="${Math.max(1, total - i + 1) * 10}" min="0" step="any" placeholder="e.g. 100" />
        </div>
      </div>
    `;
    playersGrid.appendChild(card);
  }
}

// ---- Step 2 → Step 3: Compute ----
btnCompute.addEventListener('click', () => {
  clearErrors();

  const kFactor       = parseFloat(document.getElementById('kFactor').value);
  const scalingFactor = parseFloat(document.getElementById('scalingFactor').value);
  const total         = currentTotalPlayers;

  const trophyConfig = {
    maxPos: parseFloat(document.getElementById('maxPos').value),
    midPos: parseFloat(document.getElementById('midPos').value),
    lowPos: parseFloat(document.getElementById('lowPos').value),
    lowNeg: parseFloat(document.getElementById('lowNeg').value),
    midNeg: parseFloat(document.getElementById('midNeg').value),
    maxNeg: parseFloat(document.getElementById('maxNeg').value),
  };

  // Validate
  if ([kFactor, scalingFactor, ...Object.values(trophyConfig)].some(isNaN)) {
    showError(stepPlayers, '⚠ Please fill all configuration fields with valid numbers.');
    return;
  }

  // Collect player data
  const rawPlayers = [];
  let valid = true;

  for (let i = 1; i <= total; i++) {
    const elo      = parseFloat(document.getElementById(`elo-${i}`).value);
    const trophies = parseFloat(document.getElementById(`trophies-${i}`).value);
    const score    = parseFloat(document.getElementById(`score-${i}`).value);

    if (isNaN(elo) || isNaN(trophies) || isNaN(score)) {
      showError(stepPlayers, `⚠ Player ${i} has missing or invalid values.`);
      valid = false;
      break;
    }

    rawPlayers.push({
      playerId: `Player ${i}`,
      currentElo: elo,
      currentTrophies: trophies,
      matchScore: score,
    });
  }

  if (!valid) return;

  // Assign ranks based on match score (descending) — higher score = rank 1
  const sorted = [...rawPlayers].sort((a, b) => b.matchScore - a.matchScore);

  // Handle ties: same score = same rank
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].matchScore === sorted[i - 1].matchScore) {
      sorted[i].rank = sorted[i - 1].rank;
    } else {
      sorted[i].rank = rank;
    }
    rank++;
  }

  // Build MatchPlayer array (with rank)
  const matchPlayers = sorted.map(p => ({
    playerId: p.playerId,
    currentElo: p.currentElo,
    currentTrophies: p.currentTrophies,
    rank: p.rank,
    matchScore: p.matchScore,
  }));

  // Run formula
  let results;
  try {
    results = resolveMatch(matchPlayers, trophyConfig, kFactor, scalingFactor);
  } catch (err) {
    showError(stepPlayers, `⚠ Calculation error: ${err.message}`);
    return;
  }

  // Merge rank into results (results come back in same order as matchPlayers)
  results.forEach((r, idx) => {
    r.rank = matchPlayers[idx].rank;
    r.matchScore = matchPlayers[idx].matchScore;
  });

  const meta = { kFactor, scalingFactor, total, trophyConfig, matchPlayers };
  // Results are already sorted by score (descending) since we sorted matchPlayers
  renderResults(results, meta);
  lastExportPayload = buildExportPayload(meta, results);

//   stepPlayers.classList.add('hidden');
//   stepResults.classList.remove('hidden');
//   stepResults.classList.add('animate-in');
//   window.scrollTo({ top: stepResults.offsetTop - 80, behavior: 'smooth' });
const placeholder = document.getElementById('results-placeholder');
if (placeholder) placeholder.style.display = 'none';
renderResults(results, { kFactor, scalingFactor, total, trophyConfig });
window.scrollTo({ top: document.getElementById('step-results').offsetTop - 80, behavior: 'smooth' });
});

// ---- Render Results ----
function renderResults(results, meta) {
  // Summary chips
  resultsSummary.innerHTML = `
    <div class="summary-chip">⚡ K-Factor <strong>${meta.kFactor}</strong></div>
    <div class="summary-chip">📐 Scaling <strong>${meta.scalingFactor}</strong></div>
    <div class="summary-chip">👥 Players <strong>${meta.total}</strong></div>
    <div class="summary-chip">🏆 Max Win Trophy <strong>+${meta.trophyConfig.maxPos}</strong></div>
    <div class="summary-chip">💀 Max Loss Trophy <strong>${meta.trophyConfig.maxNeg}</strong></div>
  `;

  // Table rows
  resultsTbody.innerHTML = '';

  results.forEach((r, idx) => {
    const delay = idx * 0.06;
    const tr = document.createElement('tr');
    tr.style.animationDelay = `${delay}s`;

    // Elo change styling
    const eloDelta    = r.eloDelta;
    const eloFormatted = formatDelta(eloDelta, 2);
    const eloClass    = eloDelta > 0 ? 'val-positive' : eloDelta < 0 ? 'val-negative' : 'val-neutral';

    // Trophy change styling
    const trophyDelta     = r.trophyDelta;
    const trophyFormatted = formatDelta(trophyDelta, 0);
    const trophyClass     = trophyDelta > 0 ? 'val-positive' : trophyDelta < 0 ? 'val-negative' : 'val-neutral';

    // Rank styling
    const rankClass = r.rank === 1 ? 'rank-1' : r.rank === 2 ? 'rank-2' : r.rank === 3 ? 'rank-3' : '';
    const rankEmoji = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '';

    // Player initials for avatar
    const pidNum = r.playerId.replace('Player ', '');
    const blend  = r.lossTrophy + r.actualScore * (r.winTrophy - r.lossTrophy);

    tr.innerHTML = `
      <td>
        <div class="player-cell">
          <div class="p-avatar">${pidNum}</div>
          <span class="p-name">${r.playerId}</span>
        </div>
      </td>
      <td class="rank-cell ${rankClass}">${rankEmoji} ${r.rank}</td>
      <td><strong>${r.oldElo.toFixed(0)}</strong></td>
      <td>${r.actualScore.toFixed(4)}</td>
      <td>${r.expectedScore.toFixed(4)}</td>
      <td class="elo-change-cell"><span class="${eloClass}">${eloFormatted}</span></td>
      <td><strong>${r.newElo.toFixed(2)}</strong></td>
      <td><span class="val-positive">+${r.winTrophy.toFixed(2)}</span></td>
      <td><span class="val-negative">${r.lossTrophy.toFixed(2)}</span></td>
      <td>${blend.toFixed(2)}</td>
      <td class="trophy-change-cell"><span class="${trophyClass}">${trophyFormatted}</span></td>
    `;

    resultsTbody.appendChild(tr);
  });
}

// ---- Reset ----
// btnReset.addEventListener('click', () => {
//   stepResults.classList.add('hidden');
//   stepConfig.classList.remove('hidden');
//   stepConfig.classList.add('animate-in');
//   clearErrors();
//   window.scrollTo({ top: 0, behavior: 'smooth' });
// });

// ---- Helpers ----
function formatDelta(value, decimals) {
  const rounded = parseFloat(value.toFixed(decimals));
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function showError(container, msg) {
  clearErrors();
  const div = document.createElement('div');
  div.className = 'error-msg';
  div.id = 'active-error';
  div.textContent = msg;
  container.insertBefore(div, container.querySelector('.step-actions') || container.firstChild.nextSibling);
}

function clearErrors() {
  const existing = document.getElementById('active-error');
  if (existing) existing.remove();
}

// ---- Build Export Payload ----
function buildExportPayload(meta, results) {
  return {
    simulation: {
      generatedAt: new Date().toISOString(),
      platform: "Battlebucks Match Simulator"
    },
    configuration: {
      kFactor: meta.kFactor,
      scalingFactor: meta.scalingFactor,
      totalPlayers: meta.total,
      trophyConfig: {
        winZone: {
          maxPositive: meta.trophyConfig.maxPos,
          midPositive: meta.trophyConfig.midPos,
          lowPositive: meta.trophyConfig.lowPos
        },
        lossZone: {
          lowNegative: meta.trophyConfig.lowNeg,
          midNegative: meta.trophyConfig.midNeg,
          maxNegative: meta.trophyConfig.maxNeg
        }
      }
    },
    playerInputs: meta.matchPlayers.map(p => ({
      playerId:         p.playerId,
      currentElo:       p.currentElo,
      currentTrophies:  p.currentTrophies,
      matchScore:       p.matchScore,
      assignedRank:     p.rank
    })),
    results: results.map(r => ({
      playerId:          r.playerId,
      rank:              r.rank,
      oldElo:            parseFloat(r.oldElo.toFixed(4)),
      actualScore:       parseFloat(r.actualScore.toFixed(4)),
      expectedScore:     parseFloat(r.expectedScore.toFixed(4)),
      eloRatingChange:   parseFloat(r.eloDelta.toFixed(4)),
      newElo:            parseFloat(r.newElo.toFixed(4)),
      winTrophy:         parseFloat(r.winTrophy.toFixed(4)),
      lossTrophy:        parseFloat(r.lossTrophy.toFixed(4)),
      blend:             parseFloat((r.lossTrophy + r.actualScore * (r.winTrophy - r.lossTrophy)).toFixed(4)),
      trophyChange:      r.trophyDelta,
      oldTrophies:       r.oldTrophies,
      newTrophies:       r.newTrophies
    }))
  };
}

// ---- Copy JSON ----
btnCopyJson.addEventListener('click', () => {
  if (!lastExportPayload) {
    showToast('No results to copy. Compute first.', 'error');
    return;
  }
  const json = JSON.stringify(lastExportPayload, null, 2);
  navigator.clipboard.writeText(json)
    .then(() => showToast('JSON copied to clipboard!', 'success'))
    .catch(() => {
      // Fallback for restricted environments
      const ta = document.createElement('textarea');
      ta.value = json;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('JSON copied to clipboard!', 'success');
    });
});

// ---- Download PDF ----
btnDownloadPdf.addEventListener('click', () => {
  if (!lastExportPayload) {
    showToast('No results to export. Compute first.', 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PW = 210, PH = 297;
  const ML = 15, MR = 15, MT = 15;
  const CW = PW - ML - MR;
  let y = MT;

  const C = {
    bg:       [10,  12,  20],
    surface:  [17,  24,  39],
    surface2: [26,  35,  52],
    border:   [30,  45,  69],
    accent:   [59, 130, 246],
    gold:     [245,158, 11],
    green:    [16, 185, 129],
    red:      [239, 68,  68],
    white:    [241,245, 249],
    muted:    [148,163, 184],
    faint:    [71,  85, 105],
    hlElo:    [20,  40,  80],
    hlTrophy: [60,  40,   8]
  };

  const payload = lastExportPayload;

  // ---- helpers ----
  function fillPage() {
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, PW, PH, 'F');
  }

  function newPage() {
    doc.addPage();
    fillPage();
    y = MT;
  }

  function checkY(needed) {
    if (y + needed > PH - 15) newPage();
  }

  function setFont(style, size, color) {
    doc.setFont('helvetica', style || 'normal');
    doc.setFontSize(size || 10);
    doc.setTextColor(...(color || C.white));
  }

  function labelValue(label, value, lx, vx, row_y, lColor, vColor) {
    setFont('bold', 8, lColor || C.muted);
    doc.text(label, lx, row_y);
    setFont('normal', 9, vColor || C.white);
    doc.text(String(value), vx, row_y);
  }

  function sectionHeading(title, icon_text) {
    checkY(14);
    // Accent bar
    doc.setFillColor(...C.accent);
    doc.rect(ML, y, 3, 8, 'F');
    setFont('bold', 13, C.white);
    doc.text((icon_text ? icon_text + '  ' : '') + title, ML + 6, y + 6);
    y += 12;
    // Divider
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(ML, y, ML + CW, y);
    y += 5;
  }

  function pill(text, px, py, bgColor, textColor) {
    const w = doc.getTextWidth(text) + 6;
    doc.setFillColor(...bgColor);
    doc.roundedRect(px, py - 4, w, 5.5, 1, 1, 'F');
    setFont('bold', 7, textColor);
    doc.text(text, px + 3, py);
    return w;
  }

  // ============================
  // PAGE 1 — HEADER + CONFIG
  // ============================
  fillPage();

  // Header band
  doc.setFillColor(...C.surface);
  doc.rect(0, 0, PW, 32, 'F');
  doc.setFillColor(...C.accent);
  doc.rect(0, 32, PW, 0.8, 'F');

  setFont('bold', 20, C.white);
  doc.text('BATTLEBUCKS', ML, 14);
  setFont('normal', 9, C.muted);
  doc.text('Match Simulator  |  Elo & Trophy Calculation Report', ML, 21);

  // Date + generator
  const dateStr = new Date(payload.simulation.generatedAt).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short'
  });
  setFont('normal', 8, C.faint);
  doc.text('Generated: ' + dateStr, PW - MR, 21, { align: 'right' });

  y = 42;

  // ---- Match Configuration ----
  sectionHeading('Match Configuration');

  // Config pills row
  const configs = [
    { label: 'K-Factor',       value: String(payload.configuration.kFactor) },
    { label: 'Scaling Factor', value: String(payload.configuration.scalingFactor) },
    { label: 'Total Players',  value: String(payload.configuration.totalPlayers) },
  ];

  configs.forEach((c, i) => {
    const bx = ML + i * 60;
    doc.setFillColor(...C.surface2);
    doc.roundedRect(bx, y, 55, 16, 2, 2, 'F');
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, 55, 16, 2, 2, 'S');
    setFont('normal', 7, C.muted);
    doc.text(c.label.toUpperCase(), bx + 4, y + 5);
    setFont('bold', 11, C.accent);
    doc.text(c.value, bx + 4, y + 13);
  });
  y += 24;

  // ---- Trophy Config ----
  checkY(52);
  setFont('bold', 9, C.muted);
  doc.text('TROPHY CONFIGURATION', ML, y);
  y += 6;

  const tc = payload.configuration.trophyConfig;
  const trophyCols = [
    { label: 'Max Positive  (Underdog Win)',   value: '+' + tc.winZone.maxPositive,  color: C.green },
    { label: 'Mid Positive  (Equal Match Win)', value: '+' + tc.winZone.midPositive,  color: C.green },
    { label: 'Low Positive  (Favourite Win)',   value: '+' + tc.winZone.lowPositive,  color: C.green },
    { label: 'Low Negative  (Underdog Loss)',   value: String(tc.lossZone.lowNegative), color: C.red },
    { label: 'Mid Negative  (Equal Match Loss)',value: String(tc.lossZone.midNegative), color: C.red },
    { label: 'Max Negative  (Favourite Loss)',  value: String(tc.lossZone.maxNegative), color: C.red },
  ];

  const half = Math.ceil(trophyCols.length / 2);
  trophyCols.forEach((item, i) => {
    const col = i < half ? 0 : 1;
    const row = i < half ? i : i - half;
    const bx = ML + col * (CW / 2 + 2);
    const by = y + row * 10;
    doc.setFillColor(...C.surface2);
    doc.roundedRect(bx, by, CW / 2 - 2, 8, 1, 1, 'F');
    setFont('normal', 7.5, C.muted);
    doc.text(item.label, bx + 3, by + 5.5);
    setFont('bold', 8, item.color);
    doc.text(item.value, bx + CW / 2 - 5, by + 5.5, { align: 'right' });
  });
  y += half * 10 + 8;

  // ---- Player Inputs ----
  sectionHeading('Player Inputs');

  const inputHeaders = ['Player', 'Current Elo', 'Current Trophies', 'Match Score', 'Rank'];
  const inputColW = [35, 30, 35, 30, 20];
  let cx = ML;

  // Header row
  doc.setFillColor(...C.surface2);
  doc.rect(ML, y, CW, 8, 'F');
  inputHeaders.forEach((h, i) => {
    setFont('bold', 7, C.accent);
    doc.text(h.toUpperCase(), cx + 2, y + 5.5);
    cx += inputColW[i];
  });
  y += 8;

  payload.playerInputs.forEach((p, idx) => {
    checkY(8);
    if (idx % 2 === 0) {
      doc.setFillColor(...C.surface);
      doc.rect(ML, y, CW, 7.5, 'F');
    }
    cx = ML;
    const vals = [p.playerId, p.currentElo, p.currentTrophies, p.matchScore, p.assignedRank];
    vals.forEach((v, i) => {
      setFont(i === 0 ? 'bold' : 'normal', 8, i === 0 ? C.white : C.muted);
      doc.text(String(v), cx + 2, y + 5);
      cx += inputColW[i];
    });
    y += 7.5;
  });

  y += 8;

  // ============================
  // PAGE 2 — RESULTS TABLE
  // ============================
  newPage();

  // Mini header on page 2
  doc.setFillColor(...C.surface);
  doc.rect(0, 0, PW, 14, 'F');
  doc.setFillColor(...C.accent);
  doc.rect(0, 14, PW, 0.5, 'F');
  setFont('bold', 10, C.white);
  doc.text('BATTLEBUCKS  |  Match Results', ML, 10);
  y = 22;

  sectionHeading('Calculation Results  (sorted by rank)');

  // Table column definitions
  const cols = [
    { label: 'Player',        key: 'playerId',       w: 24, align: 'left'  },
    { label: 'Rank',          key: 'rank',            w: 10, align: 'right' },
    { label: 'Old Elo',       key: 'oldElo',          w: 18, align: 'right' },
    { label: 'Score (S)',     key: 'actualScore',     w: 18, align: 'right' },
    { label: 'Exp. (E)',      key: 'expectedScore',   w: 18, align: 'right' },
    { label: 'Elo Change',    key: 'eloRatingChange', w: 20, align: 'right', highlight: 'elo' },
    { label: 'New Elo',       key: 'newElo',          w: 18, align: 'right' },
    { label: 'Win Trph',      key: 'winTrophy',       w: 17, align: 'right' },
    { label: 'Loss Trph',     key: 'lossTrophy',      w: 17, align: 'right' },
    { label: 'Blend',         key: 'blend',           w: 15, align: 'right' },
    { label: 'Trph Change',   key: 'trophyChange',    w: 15, align: 'right', highlight: 'trophy' },
  ];

  // Draw header
  doc.setFillColor(...C.surface2);
  doc.rect(ML, y, CW, 9, 'F');
  doc.setDrawColor(...C.accent);
  doc.setLineWidth(0.4);
  doc.rect(ML, y, CW, 9, 'S');

  cx = ML;
  cols.forEach(col => {
    if (col.highlight === 'elo') {
      doc.setFillColor(...C.hlElo);
      doc.rect(cx, y, col.w, 9, 'F');
    } else if (col.highlight === 'trophy') {
      doc.setFillColor(...C.hlTrophy);
      doc.rect(cx, y, col.w, 9, 'F');
    }
    setFont('bold', 6.5, col.highlight ? C.accent : C.muted);
    const tx = col.align === 'right' ? cx + col.w - 1.5 : cx + 1.5;
    doc.text(col.label.toUpperCase(), tx, y + 5.8, { align: col.align === 'right' ? 'right' : 'left' });
    cx += col.w;
  });
  y += 9;

  // Draw rows
  payload.results.forEach((r, idx) => {
    checkY(9);
    const rowH = 8.5;
    // Alternating row bg
    doc.setFillColor(...(idx % 2 === 0 ? C.surface : C.bg));
    doc.rect(ML, y, CW, rowH, 'F');

    // Highlight columns
    const eloStart = ML + cols.slice(0, 5).reduce((s, c) => s + c.w, 0);
    const trophyStart = ML + cols.slice(0, 10).reduce((s, c) => s + c.w, 0);
    doc.setFillColor(...C.hlElo);
    doc.rect(eloStart, y, cols[5].w, rowH, 'F');
    doc.setFillColor(...C.hlTrophy);
    doc.rect(trophyStart, y, cols[10].w, rowH, 'F');

    cx = ML;
    cols.forEach((col, ci) => {
      const raw = r[col.key];
      let display = '';
      let color = C.muted;

      if (col.key === 'playerId') {
        display = String(raw);
        color = C.white;
      } else if (col.key === 'rank') {
        display = String(raw);
        color = raw === 1 ? [251,191,36] : raw === 2 ? [148,163,184] : raw === 3 ? [180,83,9] : C.muted;
      } else if (col.key === 'eloRatingChange') {
        const v = parseFloat(raw);
        display = (v > 0 ? '+' : '') + v.toFixed(2);
        color = v > 0 ? C.green : v < 0 ? C.red : C.muted;
      } else if (col.key === 'trophyChange') {
        display = (raw > 0 ? '+' : '') + raw;
        color = raw > 0 ? C.green : raw < 0 ? C.red : C.muted;
      } else if (col.key === 'winTrophy') {
        display = '+' + parseFloat(raw).toFixed(2);
        color = C.green;
      } else if (col.key === 'lossTrophy') {
        display = parseFloat(raw).toFixed(2);
        color = C.red;
      } else if (typeof raw === 'number') {
        display = raw % 1 === 0 ? String(raw) : raw.toFixed(4);
      } else {
        display = String(raw);
      }

      setFont(col.key === 'playerId' || col.key === 'eloRatingChange' || col.key === 'trophyChange' ? 'bold' : 'normal', 7, color);
      const tx = col.align === 'right' ? cx + col.w - 1.5 : cx + 1.5;
      doc.text(display, tx, y + 5.5, { align: col.align === 'right' ? 'right' : 'left' });
      cx += col.w;
    });

    // Row bottom border
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.15);
    doc.line(ML, y + rowH, ML + CW, y + rowH);
    y += rowH;
  });

  y += 10;

  // ---- Formula Reference ----
  checkY(50);
  sectionHeading('Formula Reference');

  const formulas = [
    { label: 'Actual Score (S)',   formula: 'S = (n - rank) / (n - 1)' },
    { label: 'Expected Score (E)', formula: 'E = avg[ 1 / (1 + 10 ^ ((oppElo - playerElo) / scalingFactor)) ]' },
    { label: 'Elo Delta',          formula: 'delta_Elo = K x (S - E)' },
    { label: 'Win Trophy',         formula: 'WinTrph = piecewise linear interpolation on MaxPos, MidPos, LowPos vs E' },
    { label: 'Loss Trophy',        formula: 'LossTrph = piecewise linear interpolation on LowNeg, MidNeg, MaxNeg vs E' },
    { label: 'Trophy Change',      formula: 'round( LossTrph + S x (WinTrph - LossTrph) )' },
  ];

  formulas.forEach((f, i) => {
    checkY(10);
    doc.setFillColor(...C.surface2);
    doc.roundedRect(ML, y, CW, 9, 1, 1, 'F');
    setFont('bold', 7.5, C.accent);
    doc.text(f.label, ML + 3, y + 6);
    setFont('normal', 7.5, C.muted);
    doc.text(f.formula, ML + 55, y + 6);
    y += 11;
  });

  // ---- Footer on each page ----
  const totalPages = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFillColor(...C.surface);
    doc.rect(0, PH - 10, PW, 10, 'F');
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(0, PH - 10, PW, PH - 10);
    setFont('normal', 7, C.faint);
    doc.text('Battlebucks Match Simulator  |  Elo & Trophy Report', ML, PH - 3.5);
    doc.text('Page ' + pg + ' of ' + totalPages, PW - MR, PH - 3.5, { align: 'right' });
  }

  doc.save('battlebucks-match-report.pdf');
  showToast('PDF downloaded!', 'success');
});

// ---- Toast helper ----
function showToast(msg, type = 'success') {
  let toast = document.getElementById('bb-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'bb-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  // Force reflow for re-trigger
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}