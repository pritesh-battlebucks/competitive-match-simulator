// =============================================================================
// Battlebucks Simulator v2 — UI Logic
// =============================================================================

// ---- DOM References ----
const totalPlayersInput  = document.getElementById('totalPlayers');
const playersGrid        = document.getElementById('players-grid');
const playerCountLabel   = document.getElementById('player-count-label');
const rankConfigLabel    = document.getElementById('rank-config-label');
const rankConfigTbody    = document.getElementById('rank-config-tbody');
const btnCompute         = document.getElementById('btn-compute');
const btnCopyJson        = document.getElementById('btn-copy-json');
const btnDownloadPdf     = document.getElementById('btn-download-pdf');
const resultsTbody       = document.getElementById('results-tbody');
const resultsSummary     = document.getElementById('results-summary');
const resultsTableWrapper = document.getElementById('results-table-wrapper');
const resultsPlaceholder = document.getElementById('results-placeholder');
const tooltipBox         = document.getElementById('tooltip-box');
const preset2p           = document.getElementById('preset2p');
const preset6p           = document.getElementById('preset6p');

// ---- State ----
let currentTotalPlayers = 6;
let lastExportPayload   = null;

// ---- Tooltip ----
document.querySelectorAll('.tooltip-trigger').forEach(el => {
  el.addEventListener('mouseenter', () => {
    tooltipBox.textContent = el.dataset.tip;
    tooltipBox.classList.add('visible');
  });
  el.addEventListener('mousemove', e => {
    tooltipBox.style.left = (e.clientX + 14) + 'px';
    tooltipBox.style.top  = (e.clientY - 10) + 'px';
  });
  el.addEventListener('mouseleave', () => tooltipBox.classList.remove('visible'));
});

// ---- Presets ----
preset2p.addEventListener('click', () => applyPreset({
  maxPos:8, midPos:6, lowPos:3, lowNeg:-2, midNeg:-4, maxNeg:-6, tie:3
}));
preset6p.addEventListener('click', () => applyPreset({
  maxPos:40, midPos:25, lowPos:10, lowNeg:-10, midNeg:-25, maxNeg:-40, tie:5
}));

function applyPreset(c) {
  const fields = { maxPos:'maxPos', midPos:'midPos', lowPos:'lowPos',
                   lowNeg:'lowNeg', midNeg:'midNeg', maxNeg:'maxNeg', tie:'tieTrophies' };
  Object.entries(fields).forEach(([k, id]) => {
    const el = document.getElementById(id);
    el.value = c[k];
    el.style.borderColor = '#f59e0b';
    setTimeout(() => { el.style.borderColor = ''; }, 600);
  });
}

// ---- Build Rank Config Table ----
function buildRankConfigTable(total) {
  rankConfigLabel.textContent = `${total} Ranks`;
  rankConfigTbody.innerHTML = '';

  const defaults = [
    { coinSharePercent:50, gemSharePercent:50, ggSharePercent:50, bonusCoins:0, bonusGems:0, bonusGG:0,  bonusTrophies:0 },
    { coinSharePercent:30, gemSharePercent:30, ggSharePercent:30, bonusCoins:0,  bonusGems:0,  bonusGG:0,  bonusTrophies:0 },
    { coinSharePercent:20, gemSharePercent:20, ggSharePercent:20,  bonusCoins:0,   bonusGems:0,  bonusGG:0,  bonusTrophies:0  },
  ];

  for (let r = 1; r <= total; r++) {
    const def = defaults[r - 1] || { coinSharePercent:0, gemSharePercent:0, ggSharePercent:0, bonusCoins:0, bonusGems:0, bonusGG:0, bonusTrophies:0 };
    const rankClass = r === 1 ? 'rank-label-1' : r === 2 ? 'rank-label-2' : r === 3 ? 'rank-label-3' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rank-label-cell ${rankClass}">#${r}</td>
      <td><input type="number" id="rc_coinPct_${r}"   value="${def.coinSharePercent}"  min="0" max="100"/></td>
      <td><input type="number" id="rc_gemPct_${r}"    value="${def.gemSharePercent}"   min="0" max="100"/></td>
      <td><input type="number" id="rc_ggPct_${r}"     value="${def.ggSharePercent}"    min="0" max="100"/></td>
      <td><input type="number" id="rc_bCoins_${r}"    value="${def.bonusCoins}"        min="0"/></td>
      <td><input type="number" id="rc_bGems_${r}"     value="${def.bonusGems}"         min="0"/></td>
      <td><input type="number" id="rc_bGG_${r}"       value="${def.bonusGG}"           min="0"/></td>
      <td><input type="number" id="rc_bTrophies_${r}" value="${def.bonusTrophies}"     min="0"/></td>
    `;
    rankConfigTbody.appendChild(tr);
  }
}

// ---- Build Player Input Cards ----
function buildPlayerInputs(total) {
  playersGrid.innerHTML = '';
  playerCountLabel.textContent = `${total} Players`;

  const statusOptions = ['COMPLETED','ABANDONED','FORFEITED'];

  for (let i = 1; i <= total; i++) {
    const card = document.createElement('div');
    card.className = 'player-card animate-in';
    card.style.animationDelay = `${(i-1)*0.04}s`;
    card.innerHTML = `
      <div class="player-card-header">
        <div class="player-avatar">P${i}</div>
        <div class="player-name">Player ${i}</div>
      </div>
      <div class="player-fields">
        <div class="input-group">
          <label>Current Elo</label>
          <input type="number" id="elo-${i}" value="${1500 + (i-1)*50}" min="0"/>
        </div>
        <div class="input-group">
          <label>Current Trophies</label>
          <input type="number" id="trophies-${i}" value="800" min="0"/>
        </div>
        <div class="input-group">
          <label>Match Score</label>
          <input type="number" id="score-${i}" value="${Math.max(10, 70 - (i-1)*10)}" min="0" step="any"/>
        </div>
        <div class="input-group">
          <label>Match Status</label>
          <select id="status-${i}">
            ${statusOptions.map(s => `<option value="${s}"${s==='COMPLETED'?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
    playersGrid.appendChild(card);
  }
}

// ---- Init & Reactivity ----
buildRankConfigTable(parseInt(totalPlayersInput.value));
buildPlayerInputs(parseInt(totalPlayersInput.value));

totalPlayersInput.addEventListener('input', () => {
  const total = parseInt(totalPlayersInput.value);
  if (!isNaN(total) && total >= 2 && total <= 12) {
    currentTotalPlayers = total;
    buildRankConfigTable(total);
    buildPlayerInputs(total);
  }
});

// ---- Read Config from UI ----
function readConfig() {
  const total = currentTotalPlayers;

  const eloConfig = {
    kFactor:       parseFloat(document.getElementById('kFactor').value),
    scalingFactor: parseFloat(document.getElementById('scalingFactor').value),
    strategy:      document.getElementById('eloStrategy').value,
    roundMode:     document.getElementById('eloRoundMode').value,
  };

  const trophyConfig = {
    winZone: {
      maxPositive: parseFloat(document.getElementById('maxPos').value),
      midPositive: parseFloat(document.getElementById('midPos').value),
      lowPositive: parseFloat(document.getElementById('lowPos').value),
    },
    lossZone: {
      lowNegative: parseFloat(document.getElementById('lowNeg').value),
      midNegative: parseFloat(document.getElementById('midNeg').value),
      maxNegative: parseFloat(document.getElementById('maxNeg').value),
    },
    tieTrophies: parseFloat(document.getElementById('tieTrophies').value),
    strategy:    document.getElementById('trophyStrategy').value,
    roundMode:   document.getElementById('trophyRoundMode').value,
  };

  const rankConfig = [];
  for (let r = 1; r <= total; r++) {
    rankConfig.push({
      rank:              r,
      coinSharePercent:  parseFloat(document.getElementById(`rc_coinPct_${r}`).value)   || 0,
      gemSharePercent:   parseFloat(document.getElementById(`rc_gemPct_${r}`).value)    || 0,
      ggSharePercent:    parseFloat(document.getElementById(`rc_ggPct_${r}`).value)     || 0,
      bonusCoins:        parseFloat(document.getElementById(`rc_bCoins_${r}`).value)    || 0,
      bonusGems:         parseFloat(document.getElementById(`rc_bGems_${r}`).value)     || 0,
      bonusGG:           parseFloat(document.getElementById(`rc_bGG_${r}`).value)       || 0,
      bonusTrophies:     parseFloat(document.getElementById(`rc_bTrophies_${r}`).value) || 0,
    });
  }

  const entryFee = {
    coins: parseFloat(document.getElementById('entryCoins').value) || 0,
    gems:  parseFloat(document.getElementById('entryGems').value)  || 0,
    gg:    parseFloat(document.getElementById('entryGG').value)    || 0,
  };

  return { eloConfig, trophyConfig, rankConfig, entryFee };
}

// ---- Read Player Inputs from UI ----
function readPlayerInputs(total) {
  const players = [];
  for (let i = 1; i <= total; i++) {
    const elo      = parseFloat(document.getElementById(`elo-${i}`).value);
    const trophies = parseFloat(document.getElementById(`trophies-${i}`).value);
    const score    = parseFloat(document.getElementById(`score-${i}`).value);
    const status   = document.getElementById(`status-${i}`).value;

    if (isNaN(elo) || isNaN(trophies) || isNaN(score)) return null;

    players.push({
      playerId:        `Player ${i}`,
      currentElo:      elo,
      currentTrophies: trophies,
      matchScore:      score,
      matchStatus:     status,
    });
  }
  return players;
}

// ---- Compute ----
btnCompute.addEventListener('click', () => {
  clearErrors();
  const total = currentTotalPlayers;
  const { eloConfig, trophyConfig, rankConfig, entryFee } = readConfig();
  const playerInputs = readPlayerInputs(total);
  const rakeConfig = {
  coinRakePercent: parseFloat(document.getElementById('coinRakePct').value) || 0,
  gemRakePercent:  parseFloat(document.getElementById('gemRakePct').value)  || 0,
  ggRakePercent:   parseFloat(document.getElementById('ggRakePct').value)   || 0,
};

  if (!playerInputs) {
    showError('One or more players have invalid or missing values.');
    return;
  }

  const gameModeConfig = { eloConfig, trophyConfig, rankConfig, rakeConfig };

  let results;
  try {
    results = resolveMatch(playerInputs, gameModeConfig, entryFee);
  } catch (err) {
    showError('Calculation error: ' + err.message);
    return;
  }

  // Sort results for display: by rank asc
  const displayResults = [...results].sort((a, b) => a.rank - b.rank);

  // Detect tie type for display
  const fullTie    = isFullTie(playerInputs);
  const partialTie = !fullTie && displayResults.some((r, _, arr) =>
    arr.filter(x => x.rank === r.rank).length > 1
  );

  const meta = {
    eloConfig, trophyConfig, rankConfig, rakeConfig, entryFee,
    totalPlayers: total,
    fullTie, partialTie,
    totalPool: { coins: entryFee.coins * total, gems: entryFee.gems * total, gg: entryFee.gg * total },
  };

  renderResults(displayResults, meta);
  lastExportPayload = buildExportPayload(meta, playerInputs, results);
});

// ---- Render Results ----
function renderResults(results, meta) {
  resultsPlaceholder.style.display = 'none';
  resultsTableWrapper.style.display = 'block';

  // Summary chips
  const tieChip = meta.fullTie
    ? '<span class="tie-badge tie-full">Full Tie (Case B)</span>'
    : meta.partialTie
    ? '<span class="tie-badge tie-partial">Partial Tie (Case A)</span>'
    : '';

  resultsSummary.innerHTML = `
    <div class="summary-chip">K-Factor <strong>${meta.eloConfig.kFactor}</strong></div>
    <div class="summary-chip">Scaling <strong>${meta.eloConfig.scalingFactor}</strong></div>
    <div class="summary-chip">Players <strong>${meta.totalPlayers}</strong></div>
    <div class="summary-chip">Entry Fee <strong>${meta.entryFee.coins}C / ${meta.entryFee.gems}G / ${meta.entryFee.gg}GG</strong></div>
    <div class="summary-chip">Total Pool <strong>${meta.totalPool.coins}C / ${meta.totalPool.gems}G / ${meta.totalPool.gg}GG</strong></div>
    ${tieChip ? `<div class="summary-chip">${tieChip}</div>` : ''}
  `;

  resultsTbody.innerHTML = '';

  results.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.style.animationDelay = `${idx * 0.05}s`;

    const rankClass = r.rank === 1 ? 'rank-1' : r.rank === 2 ? 'rank-2' : r.rank === 3 ? 'rank-3' : '';
    const rankEmoji = r.rank === 1 ? '1st' : r.rank === 2 ? '2nd' : r.rank === 3 ? '3rd' : `${r.rank}th`;

    const statusKey = (r.matchStatus || '').toUpperCase();
    const statusClass = statusKey === 'COMPLETED' ? 'status-completed'
                      : statusKey === 'FORFEITED'  ? 'status-forfeited'
                      : statusKey === 'ABANDONED'  ? 'status-abandoned' : 'status-other';

    const eloSign  = r.eloDelta > 0 ? '+' : '';
    const eloClass = r.eloDelta > 0 ? 'val-positive' : r.eloDelta < 0 ? 'val-negative' : 'val-neutral';

    const tDelta = r.trophyDelta;
    const tClass = tDelta > 0 ? 'val-positive' : tDelta < 0 ? 'val-negative' : 'val-neutral';
    const tSign  = tDelta > 0 ? '+' : '';

    function c(val, decimals = 0) {
      if (val === 0) return '<span class="val-zero">0</span>';
      const n = decimals > 0 ? parseFloat(val).toFixed(decimals) : val;
      return val > 0 ? `<span class="val-positive">+${n}</span>` : `<span class="val-negative">${n}</span>`;
    }

    tr.innerHTML = `
  <td><div class="player-cell"><div class="p-avatar">${r.playerId.replace('Player ','')}</div><span class="p-name">${r.playerId}</span></div></td>
  <td class="rank-cell ${rankClass}">${rankEmoji}</td>
  <td><span class="status-chip ${statusClass}">${r.matchStatus}</span></td>
  <td>${r.oldElo}</td>
  <td>${r.actualScore.toFixed(4)}</td>
  <td>${r.expectedScore.toFixed(4)}</td>
  <td class="elo-change-cell group-start"><span class="${eloClass}">${eloSign}${r.eloDelta}</span></td>
  <td><strong>${r.newElo}</strong></td>
  <td class="group-start"><span class="val-positive">+${r.winTrophy.toFixed(2)}</span></td>
  <td><span class="val-negative">${r.lossTrophy.toFixed(2)}</span></td>
  <td class="trophy-change-cell"><span class="${tClass}">${tSign}${tDelta}</span></td>
  <td>${r.bonusTrophies > 0 ? `<span class="val-positive">+${r.bonusTrophies}</span>` : '<span class="val-zero">0</span>'}</td>
  <td><strong class="${r.newTrophies > r.oldTrophies ? 'val-positive' : r.newTrophies < r.oldTrophies ? 'val-negative' : ''}">${r.newTrophies}</strong></td>
  <td class="elo-change-cell group-start">${r.poolCoins > 0 ? '+'+r.poolCoins : '<span class="val-zero">0</span>'}</td>
  <td class="currency-bonus">${r.bonusCoins > 0 ? '+'+r.bonusCoins : '<span class="val-zero">0</span>'}</td>
  <td class="currency-total">${r.totalCoins > 0 ? '+'+r.totalCoins : '<span class="val-zero">0</span>'}</td>
  <td class="elo-change-cell group-start">${r.poolGems > 0 ? '+'+r.poolGems : '<span class="val-zero">0</span>'}</td>
  <td class="currency-bonus">${r.bonusGems > 0 ? '+'+r.bonusGems : '<span class="val-zero">0</span>'}</td>
  <td class="currency-total">${r.totalGems > 0 ? '+'+r.totalGems : '<span class="val-zero">0</span>'}</td>
  <td class="elo-change-cell group-start">${r.poolGG > 0 ? '+'+r.poolGG : '<span class="val-zero">0</span>'}</td>
  <td class="currency-bonus">${r.bonusGG > 0 ? '+'+r.bonusGG : '<span class="val-zero">0</span>'}</td>
  <td class="currency-total">${r.totalGG > 0 ? '+'+r.totalGG : '<span class="val-zero">0</span>'}</td>
  <td class="group-start val-zero">${r.grossPoolCoins}</td>
<td class="val-negative">${r.rakeCoins > 0 ? '-'+r.rakeCoins : '0'}</td>
<td>${r.netPoolCoins}</td>
<td class="group-start val-zero">${r.grossPoolGems}</td>
<td class="val-negative">${r.rakeGems > 0 ? '-'+r.rakeGems : '0'}</td>
<td>${r.netPoolGems}</td>
<td class="group-start val-zero">${r.grossPoolGG}</td>
<td class="val-negative">${r.rakeGG > 0 ? '-'+r.rakeGG : '0'}</td>
<td>${r.netPoolGG}</td>
`;
    resultsTbody.appendChild(tr);
  });
}

// ---- Build Export Payload ----
function buildExportPayload(meta, playerInputs, results) {
  return {
    simulation: {
      generatedAt: new Date().toISOString(),
      platform: 'Battlebucks Match Simulator v2',
      tieType: meta.fullTie ? 'FULL_TIE' : meta.partialTie ? 'PARTIAL_TIE' : 'NONE',
    },
    configuration: {
      eloConfig: meta.eloConfig,
      trophyConfig: meta.trophyConfig,
      rankConfig: meta.rankConfig,
      entryFee: meta.entryFee,
      totalPool: meta.totalPool,
      rake: {
  coinRakePercent: meta.rakeConfig.coinRakePercent,
  gemRakePercent:  meta.rakeConfig.gemRakePercent,
  ggRakePercent:   meta.rakeConfig.ggRakePercent,
},
    },
    playerInputs: playerInputs.map(p => ({
      playerId:        p.playerId,
      currentElo:      p.currentElo,
      currentTrophies: p.currentTrophies,
      matchScore:      p.matchScore,
      matchStatus:     p.matchStatus,
    })),
    results: results.map(r => ({
      playerId:           r.playerId,
      matchStatus:        r.matchStatus,
      rank:               r.rank,
      oldElo:             parseFloat(r.oldElo.toFixed(4)),
      actualScore:        parseFloat(r.actualScore.toFixed(4)),
      expectedScore:      parseFloat(r.expectedScore.toFixed(4)),
      eloDelta:           parseFloat(r.eloDelta.toFixed(4)),
      newElo:             parseFloat(r.newElo.toFixed(4)),
      winTrophy:          parseFloat(r.winTrophy.toFixed(4)),
      lossTrophy:         parseFloat(r.lossTrophy.toFixed(4)),
      formulaTrophyDelta: r.formulaTrophyDelta,
      bonusTrophies:      r.bonusTrophies,
      newTrophies:        r.newTrophies,
      poolCoins:          r.poolCoins,
      bonusCoins:         r.bonusCoins,
      totalCoins:         r.totalCoins,
      poolGems:           r.poolGems,
      bonusGems:          r.bonusGems,
      totalGems:          r.totalGems,
      poolGG:             r.poolGG,
      bonusGG:            r.bonusGG,
      totalGG:            r.totalGG,
      grossPoolCoins: r.grossPoolCoins,
rakeCoins:      r.rakeCoins,
netPoolCoins:   r.netPoolCoins,
grossPoolGems:  r.grossPoolGems,
rakeGems:       r.rakeGems,
netPoolGems:    r.netPoolGems,
grossPoolGG:    r.grossPoolGG,
rakeGG:         r.rakeGG,
netPoolGG:      r.netPoolGG,
    })),
  };
}

// ---- Copy JSON ----
btnCopyJson.addEventListener('click', () => {
  if (!lastExportPayload) { showToast('No results yet. Click Compute first.', 'error'); return; }
  const json = JSON.stringify(lastExportPayload, null, 2);
  navigator.clipboard.writeText(json)
    .then(() => showToast('JSON copied to clipboard!', 'success'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = json; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      showToast('JSON copied to clipboard!', 'success');
    });
});

// ---- Download PDF ----
btnDownloadPdf.addEventListener('click', () => {
  if (!lastExportPayload) { showToast('No results yet. Click Compute first.', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const PW = 297, PH = 210, ML = 12, MR = 12, MT = 12;
  const CW = PW - ML - MR;
  let y = MT;

  const C = {
    bg:[10,12,20], surface:[17,24,39], surface2:[26,35,52], border:[30,45,69],
    accent:[59,130,246], gold:[245,158,11], green:[16,185,129], red:[239,68,68],
    white:[241,245,249], muted:[148,163,184], faint:[71,85,105],
    hlElo:[20,40,80], hlTrophy:[60,40,8], purple:[100,70,180],
  };

  const p = lastExportPayload;

  function fillPage() { doc.setFillColor(...C.bg); doc.rect(0,0,PW,PH,'F'); }
  function newPage() { doc.addPage(); fillPage(); y = MT; }
  function checkY(n) { if (y + n > PH - 12) newPage(); }
  function sf(style, size, color) {
    doc.setFont('helvetica', style || 'normal');
    doc.setFontSize(size || 9);
    doc.setTextColor(...(color || C.white));
  }
  function sectionHeading(title) {
    checkY(14);
    doc.setFillColor(...C.accent); doc.rect(ML, y, 3, 8, 'F');
    sf('bold', 12, C.white); doc.text(title, ML + 6, y + 6);
    y += 11;
    doc.setDrawColor(...C.border); doc.setLineWidth(0.3);
    doc.line(ML, y, ML + CW, y); y += 5;
  }

  // ── PAGE 1: Header + Config ──────────────────────────────────────────────
  fillPage();

  // Header band
  doc.setFillColor(...C.surface); doc.rect(0, 0, PW, 28, 'F');
  doc.setFillColor(...C.accent);  doc.rect(0, 28, PW, 0.8, 'F');
  sf('bold', 18, C.white); doc.text('BATTLEBUCKS', ML, 12);
  sf('normal', 9, C.muted); doc.text('Match Simulator v2  |  Elo & Trophy Calculation Report', ML, 19);
  const dateStr = new Date(p.simulation.generatedAt).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' });
  sf('normal', 8, C.faint); doc.text('Generated: ' + dateStr, PW - MR, 19, { align:'right' });
  if (p.simulation.tieType !== 'NONE') {
    const tieLabel = p.simulation.tieType === 'FULL_TIE' ? 'FULL TIE (Case B)' : 'PARTIAL TIE (Case A)';
    sf('bold', 8, p.simulation.tieType === 'FULL_TIE' ? C.gold : C.accent);
    doc.text(tieLabel, PW - MR, 12, { align:'right' });
  }
  y = 36;

  sectionHeading('Match Configuration');

  // Elo + Trophy config pills
  const cfg = p.configuration;
  const cfgItems = [
    ['K-Factor', String(cfg.eloConfig.kFactor)],
    ['Scaling Factor', String(cfg.eloConfig.scalingFactor)],
    ['Total Players', String(p.playerInputs.length)],
    ['Elo Strategy', cfg.eloConfig.strategy],
    ['Trophy Strategy', cfg.trophyConfig.strategy],
    ['Elo Round Mode', cfg.eloConfig.roundMode],
    ['Trophy Round Mode', cfg.trophyConfig.roundMode],
    ['Tie Trophies', String(cfg.trophyConfig.tieTrophies)],
    ['Entry Fee', `${cfg.entryFee.coins}C / ${cfg.entryFee.gems}G / ${cfg.entryFee.gg}GG`],
    ['Total Pool', `${cfg.totalPool.coins}C / ${cfg.totalPool.gems}G / ${cfg.totalPool.gg}GG`],
  ];
  const pillW = 52, pillH = 14, pillsPerRow = 5;
  cfgItems.forEach((item, i) => {
    const col = i % pillsPerRow, row = Math.floor(i / pillsPerRow);
    const bx = ML + col * (pillW + 3), by = y + row * (pillH + 4);
    doc.setFillColor(...C.surface2); doc.roundedRect(bx, by, pillW, pillH, 1.5, 1.5, 'F');
    doc.setDrawColor(...C.border); doc.setLineWidth(0.2); doc.roundedRect(bx, by, pillW, pillH, 1.5, 1.5, 'S');
    sf('normal', 6.5, C.muted); doc.text(item[0].toUpperCase(), bx + 3, by + 4.5);
    sf('bold', 8, C.accent); doc.text(item[1], bx + 3, by + 11);
  });
  y += Math.ceil(cfgItems.length / pillsPerRow) * (pillH + 4) + 6;

  // Trophy zone config
  checkY(28);
  sectionHeading('Trophy Zone Configuration');
  const wz = cfg.trophyConfig.winZone, lz = cfg.trophyConfig.lossZone;
  const tzItems = [
    ['Max Positive (Underdog Win)', '+' + wz.maxPositive, C.green],
    ['Mid Positive (Equal Win)',    '+' + wz.midPositive, C.green],
    ['Low Positive (Favourite Win)','+' + wz.lowPositive, C.green],
    ['Low Negative (Underdog Loss)',String(lz.lowNegative), C.red],
    ['Mid Negative (Equal Loss)',   String(lz.midNegative), C.red],
    ['Max Negative (Favourite Loss)',String(lz.maxNegative), C.red],
  ];
  const half = 3;
  tzItems.forEach((item, i) => {
    const col = i < half ? 0 : 1, row = i < half ? i : i - half;
    const bx = ML + col * (CW / 2 + 2), by = y + row * 9;
    doc.setFillColor(...C.surface2); doc.roundedRect(bx, by, CW / 2 - 2, 7.5, 1, 1, 'F');
    sf('normal', 7, C.muted); doc.text(item[0], bx + 3, by + 5);
    sf('bold', 7.5, item[2]); doc.text(item[1], bx + CW / 2 - 5, by + 5, { align:'right' });
  });
  y += 3 * 9 + 8;

  // ── PAGE 1 continued: Player Inputs ──────────────────────────────────────
  checkY(40);
  sectionHeading('Player Inputs');
  const inCols = ['Player','Match Status','Current Elo','Current Trophies','Match Score'];
  const inW    = [35, 30, 28, 30, 28];
  let cx = ML;
  doc.setFillColor(...C.surface2); doc.rect(ML, y, CW, 8, 'F');
  inCols.forEach((h, i) => { sf('bold', 6.5, C.accent); doc.text(h.toUpperCase(), cx + 2, y + 5.5); cx += inW[i]; });
  y += 8;
  p.playerInputs.forEach((pl, idx) => {
    checkY(8);
    if (idx % 2 === 0) { doc.setFillColor(...C.surface); doc.rect(ML, y, CW, 7, 'F'); }
    cx = ML;
    const vals = [pl.playerId, pl.matchStatus, pl.currentElo, pl.currentTrophies, pl.matchScore];
    vals.forEach((v, i) => {
      sf(i === 0 ? 'bold' : 'normal', 8, i === 1 ? (v === 'COMPLETED' ? C.green : C.red) : i === 0 ? C.white : C.muted);
      doc.text(String(v), cx + 2, y + 5); cx += inW[i];
    });
    y += 7;
  });

  // ── PAGE 2: Results Table ─────────────────────────────────────────────────
  newPage();
  doc.setFillColor(...C.surface); doc.rect(0, 0, PW, 14, 'F');
  doc.setFillColor(...C.accent);  doc.rect(0, 14, PW, 0.5, 'F');
  sf('bold', 10, C.white); doc.text('BATTLEBUCKS  |  Match Results', ML, 10);
  y = 22;
  sectionHeading('Calculation Results (sorted by rank)');

  const resCols = [
  { h:'Player',      k:'playerId',           w:22, align:'left'  },
  { h:'Rank',        k:'rank',               w:9,  align:'right' },
  { h:'Status',      k:'matchStatus',        w:18, align:'left'  },
  // Elo
  { h:'Old Elo',     k:'oldElo',             w:14, align:'right' },
  { h:'S',           k:'actualScore',        w:12, align:'right' },
  { h:'E',           k:'expectedScore',      w:12, align:'right' },
  { h:'Elo Chg',     k:'eloDelta',           w:14, align:'right', hl:'elo' },
  { h:'New Elo',     k:'newElo',             w:14, align:'right' },
  // Trophies
  { h:'Win Trph',    k:'winTrophy',          w:13, align:'right' },
  { h:'Loss Trph',   k:'lossTrophy',         w:13, align:'right' },
  { h:'Fmla Trph',   k:'formulaTrophyDelta', w:14, align:'right', hl:'trophy' },
  { h:'Bon Trph',    k:'bonusTrophies',      w:12, align:'right' },
  { h:'Fin Trph',    k:'newTrophies',        w:12, align:'right' },
  // Coins
  { h:'Pool Coins',  k:'poolCoins',          w:14, align:'right', hl:'pool' },
  { h:'Bon Coins',   k:'bonusCoins',         w:13, align:'right' },
  { h:'Tot Coins',   k:'totalCoins',         w:13, align:'right' },
  // Gems
  { h:'Pool Gems',   k:'poolGems',           w:13, align:'right', hl:'pool' },
  { h:'Bon Gems',    k:'bonusGems',          w:12, align:'right' },
  { h:'Tot Gems',    k:'totalGems',          w:12, align:'right' },
  // GG
  { h:'Pool GG',     k:'poolGG',             w:11, align:'right', hl:'pool' },
  { h:'Bon GG',      k:'bonusGG',            w:10, align:'right' },
  { h:'Tot GG',      k:'totalGG',            w:10, align:'right' },
];

  // Scale columns to fit page width
  const totalW = resCols.reduce((s, c) => s + c.w, 0);
  const scale  = CW / totalW;
  resCols.forEach(c => { c.w = c.w * scale; });

  // Define highlight colours for the pool columns
  const C_hlPool = [8, 50, 30]; // dark green tint for pool columns

  // Header row
  doc.setFillColor(...C.surface2); doc.rect(ML, y, CW, 8.5, 'F');
  doc.setDrawColor(...C.accent); doc.setLineWidth(0.3); doc.rect(ML, y, CW, 8.5, 'S');
  cx = ML;
  resCols.forEach(col => {
    if (col.hl === 'elo')    { doc.setFillColor(...C.hlElo);    doc.rect(cx, y, col.w, 8.5, 'F'); }
    if (col.hl === 'trophy') { doc.setFillColor(...C.hlTrophy); doc.rect(cx, y, col.w, 8.5, 'F'); }
    if (col.hl === 'pool')   { doc.setFillColor(...C_hlPool);   doc.rect(cx, y, col.w, 8.5, 'F'); }
    sf('bold', 5.5, col.hl ? C.accent : C.muted);
    const tx = col.align === 'right' ? cx + col.w - 1.5 : cx + 1.5;
    doc.text(col.h.toUpperCase(), tx, y + 5.8, { align: col.align === 'right' ? 'right' : 'left' });
    cx += col.w;
  });
  y += 8.5;

  // Data rows
  p.results.forEach((r, idx) => {
    checkY(8);
    const rh = 7.5;
    doc.setFillColor(...(idx % 2 === 0 ? C.surface : C.bg));
    doc.rect(ML, y, CW, rh, 'F');

    // Apply column highlights per row
    let hcx = ML;
    resCols.forEach(col => {
      if (col.hl === 'elo')    { doc.setFillColor(...C.hlElo);    doc.rect(hcx, y, col.w, rh, 'F'); }
      if (col.hl === 'trophy') { doc.setFillColor(...C.hlTrophy); doc.rect(hcx, y, col.w, rh, 'F'); }
      if (col.hl === 'pool')   { doc.setFillColor(...C_hlPool);   doc.rect(hcx, y, col.w, rh, 'F'); }
      hcx += col.w;
    });

    cx = ML;
    resCols.forEach(col => {
      const raw = r[col.k];
      let txt = '', color = C.muted, bold = false;

      if (col.k === 'playerId') {
        txt = String(raw); color = C.white; bold = true;
      } else if (col.k === 'rank') {
        txt = String(raw);
        color = raw === 1 ? [251,191,36] : raw === 2 ? [148,163,184] : raw === 3 ? [180,83,9] : C.muted;
        bold = true;
      } else if (col.k === 'matchStatus') {
        txt = String(raw);
        color = raw === 'COMPLETED' ? C.green : C.red;
      } else if (col.k === 'eloDelta') {
        txt = (raw > 0 ? '+' : '') + raw;
        color = raw > 0 ? C.green : raw < 0 ? C.red : C.muted; bold = true;
      } else if (col.k === 'newElo') {
        txt = String(raw); color = C.white; bold = true;
      } else if (col.k === 'winTrophy') {
        txt = '+' + parseFloat(raw).toFixed(2); color = C.green;
      } else if (col.k === 'lossTrophy') {
        txt = parseFloat(raw).toFixed(2); color = C.red;
      } else if (col.k === 'formulaTrophyDelta') {
        txt = (raw > 0 ? '+' : '') + raw;
        color = raw > 0 ? C.green : raw < 0 ? C.red : C.muted; bold = true;
      } else if (col.k === 'bonusTrophies') {
        txt = raw > 0 ? '+' + raw : '0'; color = raw > 0 ? C.green : C.muted;
      } else if (col.k === 'newTrophies') {
        txt = String(raw); color = C.white; bold = true;
      } else if (['poolCoins','poolGems','poolGG'].includes(col.k)) {
        txt = raw > 0 ? '+' + raw : '0'; color = raw > 0 ? C.green : C.muted;
      } else if (['bonusCoins','bonusGems','bonusGG'].includes(col.k)) {
        txt = raw > 0 ? '+' + raw : '0'; color = raw > 0 ? [180,140,255] : C.muted;
      } else if (['totalCoins','totalGems','totalGG'].includes(col.k)) {
        txt = raw > 0 ? '+' + raw : '0'; color = raw > 0 ? C.white : C.muted; bold = true;
      } else if (typeof raw === 'number') {
        txt = raw % 1 !== 0 ? raw.toFixed(4) : String(raw);
      } else {
        txt = String(raw);
      }

      sf(bold ? 'bold' : 'normal', 6, color);
      const tx = col.align === 'right' ? cx + col.w - 1.5 : cx + 1.5;
      doc.text(txt, tx, y + 5, { align: col.align === 'right' ? 'right' : 'left' });
      cx += col.w;
    });

    doc.setDrawColor(...C.border); doc.setLineWidth(0.1);
    doc.line(ML, y + rh, ML + CW, y + rh);
    y += rh;
  });

  // ── PAGE 3: Rank Config + Formula Reference ───────────────────────────────
  newPage();
  doc.setFillColor(...C.surface); doc.rect(0,0,PW,14,'F');
  doc.setFillColor(...C.accent);  doc.rect(0,14,PW,0.5,'F');
  sf('bold',10,C.white); doc.text('BATTLEBUCKS  |  Configuration Details', ML, 10);
  y = 22;

  sectionHeading('Rank Reward Configuration');
  const rcCols = ['Rank','Coin Pool %','Gem Pool %','GG Pool %','Bonus Coins','Bonus Gems','Bonus GG','Bonus Trophies'];
  const rcW = [18, 22, 20, 18, 22, 20, 18, 22];
  cx = ML;
  doc.setFillColor(...C.surface2); doc.rect(ML, y, CW, 8, 'F');
  rcCols.forEach((h, i) => { sf('bold', 6.5, C.accent); doc.text(h.toUpperCase(), cx + 2, y + 5.5); cx += rcW[i]; });
  y += 8;
  p.configuration.rankConfig.forEach((rc, idx) => {
    checkY(8);
    if (idx % 2 === 0) { doc.setFillColor(...C.surface); doc.rect(ML, y, CW, 7, 'F'); }
    cx = ML;
    const vals = [rc.rank, rc.coinSharePercent+'%', rc.gemSharePercent+'%', rc.ggSharePercent+'%',
                  rc.bonusCoins, rc.bonusGems, rc.bonusGG, rc.bonusTrophies];
    vals.forEach((v, i) => {
      sf(i === 0 ? 'bold' : 'normal', 8, i === 0 ? C.white : C.muted);
      doc.text(String(v), cx + 2, y + 5); cx += rcW[i];
    });
    y += 7;
  });
  y += 8;

  sectionHeading('Formula Reference');
  const formulas = [
    ['Actual Score (S)',    'S = (n - rank) / (n - 1)'],
    ['Expected Score (E)', 'E = avg[ 1 / (1 + 10 ^ ((oppElo - playerElo) / scalingFactor)) ]'],
    ['Elo Delta',          'delta_Elo = K x (S - E)'],
    ['Win Trophy',         'Piecewise linear: MaxPos->MidPos (E in [0,0.5)) | MidPos->LowPos (E in [0.5,1])'],
    ['Loss Trophy',        'Piecewise linear: LowNeg->MidNeg (E in [0,0.5)) | MidNeg->MaxNeg (E in [0.5,1])'],
    ['Trophy Change (raw)','round( LossTrophy + S x (WinTrophy - LossTrophy) )'],
    ['Partial Tie (A)',     'All tied-rank players get the HIGHEST formula trophy in their rank group'],
    ['Full Tie (B)',        'All elo deltas = 0; all trophy deltas = tieTrophies; rewards split equally by n'],
    ['Pool Rewards',       'poolShare = floor( totalPool x coinSharePercent% / groupSize )'],
    ['Bonus Rewards',      'bonusSplit = floor( bonusX / groupSize ); bonus trophies = round( bonusTrophies / groupSize )'],
  ];
  formulas.forEach(f => {
    checkY(10);
    doc.setFillColor(...C.surface2); doc.roundedRect(ML, y, CW, 8.5, 1, 1, 'F');
    sf('bold', 7.5, C.accent); doc.text(f[0], ML + 3, y + 5.8);
    sf('normal', 7, C.muted); doc.text(f[1], ML + 60, y + 5.8);
    y += 10.5;
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFillColor(...C.surface); doc.rect(0, PH - 9, PW, 9, 'F');
    doc.setDrawColor(...C.border); doc.setLineWidth(0.3); doc.line(0, PH - 9, PW, PH - 9);
    sf('normal', 7, C.faint);
    doc.text('Battlebucks Match Simulator v2  |  Elo & Trophy Report', ML, PH - 3);
    doc.text('Page ' + pg + ' of ' + totalPages, PW - MR, PH - 3, { align:'right' });
  }

  doc.save('battlebucks-match-report.pdf');
  showToast('PDF downloaded!', 'success');
});

// ---- Error / Toast Helpers ----
function showError(msg) {
  clearErrors();
  const div = document.createElement('div');
  div.id = 'active-error'; div.className = 'error-msg'; div.textContent = msg;
  const target = document.getElementById('step-players');
  target.insertBefore(div, target.querySelector('.step-actions'));
}
function clearErrors() {
  const e = document.getElementById('active-error');
  if (e) e.remove();
}
function showToast(msg, type = 'success') {
  let toast = document.getElementById('bb-toast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'bb-toast'; toast.className = 'toast'; document.body.appendChild(toast); }
  toast.textContent = msg; toast.className = 'toast ' + type;
  void toast.offsetWidth; toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}