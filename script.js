const totalPlayersInput = document.getElementById('totalPlayers');
const playersGrid = document.getElementById('players-grid');
const playerCountLabel = document.getElementById('player-count-label');
const rankConfigBody = document.getElementById('rank-config-body');
const btnCompute = document.getElementById('btn-compute');
const resultsTbody = document.getElementById('results-tbody');
const resultsSummary = document.getElementById('results-summary');
const resultsPlaceholder = document.getElementById('results-placeholder');
const btnCopyJson = document.getElementById('btn-copy-json');
const btnDownloadPdf = document.getElementById('btn-download-pdf');

let currentTotalPlayers = parseInt(totalPlayersInput.value, 10) || 6;
let lastExportPayload = null;

function buildRankConfigInputs(total) {
  rankConfigBody.innerHTML = '';
  for (let rank = 1; rank <= total; rank++) {
    const defaults = rank === 1
      ? { share: 50, bonusAmount: 100, bonusTrophies: 20 }
      : rank === 2
      ? { share: 30, bonusAmount: 50, bonusTrophies: 10 }
      : rank === 3
      ? { share: 20, bonusAmount: 0, bonusTrophies: 0 }
      : { share: 0, bonusAmount: 0, bonusTrophies: 0 };

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${rank}</td>
      <td><input type="number" id="rank-share-${rank}" value="${defaults.share}" min="0" max="100"></td>
      <td><input type="number" id="rank-bonus-amount-${rank}" value="${defaults.bonusAmount}" min="0"></td>
      <td><input type="number" id="rank-bonus-trophy-${rank}" value="${defaults.bonusTrophies}"></td>
    `;
    rankConfigBody.appendChild(tr);
  }
}

function buildPlayerInputs(total) {
  playersGrid.innerHTML = '';
  playerCountLabel.textContent = `${total} Players`;

  for (let i = 1; i <= total; i++) {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="player-card-header">
        <div class="player-avatar">P${i}</div>
        <div><strong>Player ${i}</strong></div>
      </div>
      <div class="input-group"><label>Current Elo</label><input type="number" id="elo-${i}" value="${1500 + (i - 1) * 50}" min="0"></div>
      <div class="input-group"><label>Current Trophies</label><input type="number" id="trophies-${i}" value="800" min="0"></div>
      <div class="input-group"><label>Match Score</label><input type="number" id="score-${i}" value="${Math.max(1, total - i + 1) * 10}" step="any"></div>
      <div class="input-group"><label>Match Status</label>
        <select id="status-${i}">
          <option value="COMPLETED" selected>COMPLETED</option>
          <option value="ABANDONED">ABANDONED</option>
          <option value="FORFEITED">FORFEITED</option>
        </select>
      </div>
    `;
    playersGrid.appendChild(card);
  }
}

function getBaseConfig() {
  return {
    entryFee: parseFloat(document.getElementById('entryFee').value) || 0,
    currency: document.getElementById('currencyType').value,
    rakePercent: parseFloat(document.getElementById('rakePercent').value) || 0,
  };
}

function getEloConfig() {
  return {
    scalingFactor: parseFloat(document.getElementById('scalingFactor').value) || 400,
    kFactor: parseFloat(document.getElementById('kFactor').value) || 32,
    strategy: 'PAIRWISE_AVERAGE_RANK',
    roundMode: document.getElementById('eloRoundMode').value,
  };
}

function getTrophyConfig() {
  return {
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
    tieTrophies: parseFloat(document.getElementById('tieTrophies').value) || 0,
    strategy: 'DYNAMIC_SLIDING_SCALE',
    roundMode: document.getElementById('trophyRoundMode').value,
  };
}

function getRankConfig(total) {
  const arr = [];
  for (let rank = 1; rank <= total; rank++) {
    arr.push({
      rank,
      poolSharePercent: parseFloat(document.getElementById(`rank-share-${rank}`).value) || 0,
      bonusAmount: parseFloat(document.getElementById(`rank-bonus-amount-${rank}`).value) || 0,
      bonusTrophies: parseFloat(document.getElementById(`rank-bonus-trophy-${rank}`).value) || 0,
    });
  }
  return arr;
}

function collectPlayers(total) {
  const arr = [];
  for (let i = 1; i <= total; i++) {
    arr.push({
      playerId: `Player ${i}`,
      currentElo: parseFloat(document.getElementById(`elo-${i}`).value) || 0,
      currentTrophies: parseFloat(document.getElementById(`trophies-${i}`).value) || 0,
      matchScore: parseFloat(document.getElementById(`score-${i}`).value) || 0,
      matchStatus: document.getElementById(`status-${i}`).value,
    });
  }
  return arr;
}

function formatDelta(v) {
  return v > 0 ? `+${v}` : `${v}`;
}

function renderResults(results, meta) {
  if (!results.length) return;
  resultsPlaceholder.style.display = 'none';
  resultsTbody.innerHTML = '';

  const r0 = results[0];
  resultsSummary.innerHTML = `
    <div class="summary-chip">K-Factor <strong>${meta.kFactor}</strong></div>
    <div class="summary-chip">Scaling <strong>${meta.scalingFactor}</strong></div>
    <div class="summary-chip">Players <strong>${meta.total}</strong></div>
    <div class="summary-chip">Entry Fee <strong>${meta.baseConfig.entryFee} ${meta.baseConfig.currency}</strong></div>
    <div class="summary-chip">Total Pool <strong>${r0.grossPool} ${meta.baseConfig.currency}</strong></div>
    <div class="summary-divider"></div>
    <div class="summary-chip rake-chip">Gross Pool <strong>${r0.grossPool} ${meta.baseConfig.currency}</strong></div>
    <div class="summary-chip rake-chip">Rake <strong>${meta.baseConfig.rakePercent}%</strong></div>
    <div class="summary-chip rake-chip">Rake Amount <strong>${r0.rakeAmount} ${meta.baseConfig.currency}</strong></div>
    <div class="summary-chip rake-chip">Net Pool <strong>${r0.distributablePool} ${meta.baseConfig.currency}</strong></div>
  `;

  [...results].sort((a, b) => a.rank - b.rank).forEach(r => {
    const tr = document.createElement('tr');
    const eloClass = r.eloDelta > 0 ? 'val-positive' : r.eloDelta < 0 ? 'val-negative' : 'val-zero';
    const trophClass = r.formulaTrophyDelta > 0 ? 'val-positive' : r.formulaTrophyDelta < 0 ? 'val-negative' : 'val-zero';
    const statusClass = r.matchStatus === 'COMPLETED' ? 'status-completed' : 'status-other';
    tr.innerHTML = `
      <td><div class="player-cell"><div class="p-avatar">${r.playerId.replace('Player ', '')}</div><span class="p-name">${r.playerId}</span></div></td>
      <td class="rank-cell">${r.rank}</td>
      <td><span class="status-chip ${statusClass}">${r.matchStatus}</span></td>
      <td>${r.oldElo}</td>
      <td>${r.actualScore.toFixed(4)}</td>
      <td>${r.expectedScore.toFixed(4)}</td>
      <td class="elo-change-cell"><span class="${eloClass}">${formatDelta(r.eloDelta)}</span></td>
      <td>${r.newElo}</td>
      <td class="trophy-change-cell"><span class="${trophClass}">${formatDelta(r.formulaTrophyDelta)}</span></td>
      <td>${r.bonusTrophies > 0 ? `<span class="val-positive">+${r.bonusTrophies}</span>` : '<span class="val-zero">0</span>'}</td>
      <td>${r.newTrophies}</td>
      <td class="pool-cell">${r.poolAmount > 0 ? `+${r.poolAmount}` : '<span class="val-zero">0</span>'}</td>
      <td>${r.bonusAmount > 0 ? `+${r.bonusAmount}` : '<span class="val-zero">0</span>'}</td>
      <td>${r.totalAmount > 0 ? `+${r.totalAmount}` : '<span class="val-zero">0</span>'}</td>
    `;
    resultsTbody.appendChild(tr);
  });
  // <td><span class="val-positive">+${r.winTrophy.toFixed(2)}</span></td>
  // <td><span class="val-negative">${r.lossTrophy.toFixed(2)}</span></td>
}

function buildExportPayload(meta, results) {
  return {
    simulation: {
      generatedAt: new Date().toISOString(),
      platform: 'Battlebucks Match Simulator',
    },
    configuration: {
      baseConfig: meta.baseConfig,
      eloConfig: meta.eloConfig,
      trophyConfig: meta.trophyConfig,
      rankConfig: meta.rankConfig,
    },
    playerInputs: meta.playerInputs,
    results: results.map(r => ({
      playerId: r.playerId,
      matchStatus: r.matchStatus,
      matchScore: r.matchScore,
      rank: r.rank,
      oldElo: r.oldElo,
      actualScore: Number(r.actualScore.toFixed(4)),
      expectedScore: Number(r.expectedScore.toFixed(4)),
      eloDelta: r.eloDelta,
      newElo: r.newElo,
      winTrophy: Number(r.winTrophy.toFixed(4)),
      lossTrophy: Number(r.lossTrophy.toFixed(4)),
      formulaTrophyDelta: r.formulaTrophyDelta,
      bonusTrophies: r.bonusTrophies,
      newTrophies: r.newTrophies,
      poolAmount: r.poolAmount,
      bonusAmount: r.bonusAmount,
      totalAmount: r.totalAmount,
      currency: r.currency,
      grossPool: r.grossPool,
      rakePercent: r.rakePercent,
      rakeAmount: r.rakeAmount,
      distributablePool: r.distributablePool,
    })),
  };
}

function showToast(msg, type = 'success') {
  let toast = document.getElementById('bb-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'bb-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

function downloadPdf(payload) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const ML = 10, MR = 10, MT = 12;
  const CW = PW - ML - MR;
  let y = MT;

  const C = {
    bg:[10,12,20], surface:[17,24,39], surface2:[25,34,52], border:[40,52,74], accent:[59,130,246],
    gold:[245,158,11], green:[16,185,129], red:[239,68,68], white:[241,245,249], muted:[148,163,184],
    hlElo:[20,40,80], hlTrophy:[70,48,8], hlPool:[8,50,30]
  };

  const sf = (style='normal', size=8, color=C.white) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const fillBg = () => { doc.setFillColor(...C.bg); doc.rect(0,0,PW,PH,'F'); };
  const checkY = (need) => {
    if (y + need > PH - 12) {
      doc.addPage();
      fillBg();
      y = MT;
    }
  };
  fillBg();

  doc.setFillColor(...C.surface); doc.rect(0,0,PW,22,'F');
  doc.setFillColor(...C.accent); doc.rect(0,22,PW,.7,'F');
  sf('bold', 18, C.white); doc.text('COMPETITIVE MATCH SIMULATOR - BATTLEBUCKS', ML, 10);
  sf('normal', 9, C.muted); doc.text('Elo, Trophy & Reward Calculation Report for Competitive Match', ML, 16);
  sf('italic', 9, C.muted); doc.text('Author: Pritesh Srv', PW - MR, 10, { align: 'right' });
  y = 30;

  const m = payload.configuration;
  const r0 = payload.results[0];
  const chips = [
    ['K-Factor', m.eloConfig.kFactor],
    ['Scaling', m.eloConfig.scalingFactor],
    ['Players', payload.playerInputs.length],
    ['Entry Fee', `${m.baseConfig.entryFee} ${m.baseConfig.currency}`],
    ['Total Pool', `${r0.grossPool} ${m.baseConfig.currency}`],
    ['Gross Pool', `${r0.grossPool} ${m.baseConfig.currency}`],
    ['Rake', `${m.baseConfig.rakePercent}%`],
    ['Rake Amount', `${r0.rakeAmount} ${m.baseConfig.currency}`],
    ['Net Pool', `${r0.distributablePool} ${m.baseConfig.currency}`],
  ];
  let cx = ML;
  chips.forEach(([label, val], idx) => {
    sf('normal', 7, C.muted); const lw = doc.getTextWidth(label + ' ');
    sf('bold', 7, C.white); const vw = doc.getTextWidth(String(val));
    const w = lw + vw + 10;
    if (cx + w > PW - MR) { cx = ML; y += 11; }
    doc.setFillColor(...(idx >= 5 ? [55,20,20] : C.surface2));
    doc.setDrawColor(...(idx >= 5 ? [120,60,60] : C.border));
    doc.roundedRect(cx, y, w, 8, 2, 2, 'FD');
    sf('normal', 7, C.muted); doc.text(label + ' ', cx + 4, y + 5.2);
    sf('bold', 7, idx === 6 || idx === 7 ? C.red : C.accent); doc.text(String(val), cx + 4 + lw, y + 5.2);
    cx += w + 3;
  });
  y += 15;

  sf('bold', 10, C.white); doc.text('Results', ML, y); y += 5;

  const resCols = [
    { h:'Player', k:'playerId', w:22, a:'left' },
    { h:'Rank', k:'rank', w:9, a:'right' },
    { h:'Status', k:'matchStatus', w:18, a:'left' },
    { h:'Old Elo', k:'oldElo', w:14, a:'right' },
    { h:'S', k:'actualScore', w:12, a:'right' },
    { h:'E', k:'expectedScore', w:12, a:'right' },
    { h:'Elo Chg', k:'eloDelta', w:14, a:'right', hl:'elo' },
    { h:'New Elo', k:'newElo', w:14, a:'right' },
    // { h:'Win Tr', k:'winTrophy', w:13, a:'right' },
    // { h:'Loss Tr', k:'lossTrophy', w:13, a:'right' },
    { h:'Fmla Tr', k:'formulaTrophyDelta', w:14, a:'right', hl:'trophy' },
    { h:'Bon Tr', k:'bonusTrophies', w:12, a:'right' },
    { h:'Final Tr', k:'newTrophies', w:12, a:'right' },
    { h:'Pool Amt', k:'poolAmount', w:14, a:'right', hl:'pool' },
    { h:'Bon Amt', k:'bonusAmount', w:13, a:'right' },
    { h:'Tot Amt', k:'totalAmount', w:13, a:'right' },
  ];
  const totalW = resCols.reduce((s,c)=>s+c.w,0);
  const scale = CW / totalW;
  resCols.forEach(c => c.w = c.w * scale);

  checkY(10);
  doc.setFillColor(...C.surface2); doc.rect(ML, y, CW, 8, 'F');
  let x = ML;
  resCols.forEach(col => {
    if (col.hl === 'elo') { doc.setFillColor(...C.hlElo); doc.rect(x, y, col.w, 8, 'F'); }
    if (col.hl === 'trophy') { doc.setFillColor(...C.hlTrophy); doc.rect(x, y, col.w, 8, 'F'); }
    if (col.hl === 'pool') { doc.setFillColor(...C.hlPool); doc.rect(x, y, col.w, 8, 'F'); }
    sf('bold', 6.6, col.hl ? C.accent : C.muted);
    doc.text(col.h, col.a === 'right' ? x + col.w - 1.5 : x + 1.5, y + 5.2, { align: col.a === 'right' ? 'right' : 'left' });
    x += col.w;
  });
  y += 8;

  payload.results.forEach((r, idx) => {
    checkY(7);
    const rh = 7;
    doc.setFillColor(...(idx % 2 === 0 ? C.surface : C.bg)); doc.rect(ML, y, CW, rh, 'F');
    let hx = ML;
    resCols.forEach(col => {
      if (col.hl === 'elo') { doc.setFillColor(...C.hlElo); doc.rect(hx, y, col.w, rh, 'F'); }
      if (col.hl === 'trophy') { doc.setFillColor(...C.hlTrophy); doc.rect(hx, y, col.w, rh, 'F'); }
      if (col.hl === 'pool') { doc.setFillColor(...C.hlPool); doc.rect(hx, y, col.w, rh, 'F'); }
      hx += col.w;
    });
    x = ML;
    resCols.forEach(col => {
      let raw = r[col.k], txt = '', color = C.muted, bold = false;
      if (col.k === 'playerId') { txt = String(raw); color = C.white; bold = true; }
      else if (col.k === 'matchStatus') { txt = String(raw); color = raw === 'COMPLETED' ? C.green : C.red; }
      else if (col.k === 'eloDelta') { txt = (raw > 0 ? '+' : '') + raw; color = raw > 0 ? C.green : raw < 0 ? C.red : C.muted; bold = true; }
      else if (col.k === 'winTrophy') { txt = '+' + Number(raw).toFixed(2); color = C.green; }
      else if (col.k === 'lossTrophy') { txt = Number(raw).toFixed(2); color = C.red; }
      else if (col.k === 'formulaTrophyDelta') { txt = (raw > 0 ? '+' : '') + raw; color = raw > 0 ? C.green : raw < 0 ? C.red : C.muted; bold = true; }
      else if (col.k === 'bonusTrophies' || col.k === 'poolAmount' || col.k === 'bonusAmount' || col.k === 'totalAmount') {
        txt = raw > 0 ? '+' + raw : '0';
        color = raw > 0 ? C.green : C.muted;
        bold = col.k === 'poolAmount' || col.k === 'totalAmount';
      } else if (typeof raw === 'number') {
        txt = raw % 1 === 0 ? String(raw) : raw.toFixed(4);
      } else txt = String(raw);
      sf(bold ? 'bold' : 'normal', 6.7, color);
      doc.text(txt, col.a === 'right' ? x + col.w - 1.5 : x + 1.5, y + 4.7, { align: col.a === 'right' ? 'right' : 'left' });
      x += col.w;
    });
    y += rh;
  });

  doc.save('competitive-match-report.pdf');
}

btnCopyJson.addEventListener('click', async () => {
  if (!lastExportPayload) return showToast('No results to copy.', 'error');
  const txt = JSON.stringify(lastExportPayload, null, 2);
  try {
    await navigator.clipboard.writeText(txt);
    showToast('JSON copied to clipboard!', 'success');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('JSON copied to clipboard!', 'success');
  }
});

btnDownloadPdf.addEventListener('click', () => {
  if (!lastExportPayload) return showToast('No results to export.', 'error');
  downloadPdf(lastExportPayload);
  showToast('PDF downloaded!', 'success');
});

btnCompute.addEventListener('click', () => {
  try {
    const total = currentTotalPlayers;
    const baseConfig = getBaseConfig();
    const eloConfig = getEloConfig();
    const trophyConfig = getTrophyConfig();
    const rankConfig = getRankConfig(total);
    const playerInputs = collectPlayers(total);
    const config = { baseConfig, eloConfig, trophyConfig, rankConfig };
    const results = resolveMatch(playerInputs, config);

    const meta = {
      total,
      baseConfig,
      eloConfig,
      trophyConfig,
      rankConfig,
      kFactor: eloConfig.kFactor,
      scalingFactor: eloConfig.scalingFactor,
      playerInputs,
    };

    renderResults(results, meta);
    lastExportPayload = buildExportPayload(meta, results);
    showToast('Results computed successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Computation failed.', 'error');
  }
});

totalPlayersInput.addEventListener('input', () => {
  const total = parseInt(totalPlayersInput.value, 10);
  if (!isNaN(total) && total >= 2 && total <= 12) {
    currentTotalPlayers = total;
    buildPlayerInputs(total);
    buildRankConfigInputs(total);
  }
});

buildPlayerInputs(currentTotalPlayers);
buildRankConfigInputs(currentTotalPlayers);