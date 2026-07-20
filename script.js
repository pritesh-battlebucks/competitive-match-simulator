// ── DOM refs ─────────────────────────────────────────────
const totalPlayersInput = document.getElementById('totalPlayers');
const playersGrid       = document.getElementById('players-grid');
const playerCountLabel  = document.getElementById('player-count-label');
const rankConfigBody    = document.getElementById('rank-config-body');
const tierConfigBody    = document.getElementById('tier-config-body');
const btnCompute        = document.getElementById('btn-compute');
const btnAddTier        = document.getElementById('btn-add-tier');
const resultsTbody      = document.getElementById('results-tbody');
const resultsSummary    = document.getElementById('results-summary');
const resultsPlaceholder = document.getElementById('results-placeholder');
const btnCopyJson       = document.getElementById('btn-copy-json');
const btnDownloadPdf    = document.getElementById('btn-download-pdf');

let currentTotalPlayers = parseInt(totalPlayersInput.value, 10) || 6;
let lastExportPayload   = null;

// ── Default tiers ─────────────────────────────────────────
const DEFAULT_TIERS = [
  { name: 'ROOKIE',   positiveMultiplier: 1.3,  negativeMultiplier: 0.5 },
  { name: 'EXPERT',   positiveMultiplier: 1.2,  negativeMultiplier: 0.6 },
  { name: 'ACE',      positiveMultiplier: 1.1,  negativeMultiplier: 0.7 },
  { name: 'ELITE',    positiveMultiplier: 1.0,  negativeMultiplier: 0.8 },
  { name: 'MASTER',   positiveMultiplier: 0.95, negativeMultiplier: 0.9 },
  { name: 'CHAMPION', positiveMultiplier: 0.9,  negativeMultiplier: 1.0 },
];

// ── Tier Config UI ────────────────────────────────────────
function buildTierConfigInputs(tiers) {
  tierConfigBody.innerHTML = '';
  tiers.forEach((tier, idx) => addTierRow(tier, idx));
}

function addTierRow(tier = { name: '', positiveMultiplier: 1.0, negativeMultiplier: 1.0 }, idx) {
  const rowIdx = idx !== undefined ? idx : tierConfigBody.rows.length;
  const tr = document.createElement('tr');
  tr.dataset.tierIdx = rowIdx;
  tr.innerHTML = `
    <td><input type="text" class="tier-name-input" id="tier-name-${rowIdx}" value="${tier.name}" placeholder="Tier name" /></td>
    <td><input type="number" class="tier-num-input" id="tier-pos-${rowIdx}" value="${tier.positiveMultiplier}" step="0.05" min="0" /></td>
    <td><input type="number" class="tier-num-input" id="tier-neg-${rowIdx}" value="${tier.negativeMultiplier}" step="0.05" min="0" /></td>
    <td><button class="btn-remove-tier" onclick="removeTierRow(this)">✕</button></td>
  `;
  tierConfigBody.appendChild(tr);
  refreshPlayerTierSelects();
}

function removeTierRow(btn) {
  btn.closest('tr').remove();
  rebuildTierIndices();
  refreshPlayerTierSelects();
}

function rebuildTierIndices() {
  Array.from(tierConfigBody.rows).forEach((tr, i) => {
    tr.dataset.tierIdx = i;
    tr.querySelector('.tier-name-input').id = `tier-name-${i}`;
    tr.querySelector(`input[id^="tier-pos"]`).id = `tier-pos-${i}`;
    tr.querySelector(`input[id^="tier-neg"]`).id = `tier-neg-${i}`;
  });
}

function getTiers() {
  return Array.from(tierConfigBody.rows).map((tr, i) => ({
    name: (document.getElementById(`tier-name-${i}`)?.value || '').trim(),
    positiveMultiplier: parseFloat(document.getElementById(`tier-pos-${i}`)?.value) || 1,
    negativeMultiplier: parseFloat(document.getElementById(`tier-neg-${i}`)?.value) || 1,
  })).filter(t => t.name !== '');
}

function refreshPlayerTierSelects() {
  const tiers = getTiers();
  const options = tiers.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
  document.querySelectorAll('.player-tier-select').forEach(sel => {
    const prev = sel.value;
    sel.innerHTML = `<option value="">— None —</option>${options}`;
    if (tiers.find(t => t.name === prev)) sel.value = prev;
  });
}

// ── Safety Config ─────────────────────────────────────────
function getSafetyConfig() {
  return {
    maxGain: parseFloat(document.getElementById('safetyMaxGain').value) || Infinity,
    maxLoss: parseFloat(document.getElementById('safetyMaxLoss').value) || Infinity,
  };
}

// ── Rank Config ───────────────────────────────────────────
function buildRankConfigInputs(total) {
  rankConfigBody.innerHTML = '';
  for (let rank = 1; rank <= total; rank++) {
    const d = rank === 1 ? { share: 50, bonusAmount: 100, bonusTrophies: 20 }
            : rank === 2 ? { share: 30, bonusAmount: 50,  bonusTrophies: 10 }
            : rank === 3 ? { share: 20, bonusAmount: 0,   bonusTrophies: 0  }
            :              { share: 0,  bonusAmount: 0,   bonusTrophies: 0  };
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${rank}</td>
      <td><input type="number" id="rank-share-${rank}" value="${d.share}" min="0" max="100"></td>
      <td><input type="number" id="rank-bonus-amount-${rank}" value="${d.bonusAmount}" min="0"></td>
      <td><input type="number" id="rank-bonus-trophy-${rank}" value="${d.bonusTrophies}"></td>
    `;
    rankConfigBody.appendChild(tr);
  }
}

// ── Player Inputs ─────────────────────────────────────────
function buildPlayerInputs(total) {
  playersGrid.innerHTML = '';
  playerCountLabel.textContent = `${total} Players`;
  const tiers = getTiers();
  const tierOptions = tiers.map(t => `<option value="${t.name}">${t.name}</option>`).join('');

  for (let i = 1; i <= total; i++) {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="player-card-header">
        <div class="player-avatar">P${i}</div>
        <div><strong>Player ${i}</strong></div>
      </div>
      <div class="input-group"><label>Current Elo</label><input type="number" id="elo-${i}" value="${1500 + (i-1)*50}" min="0"></div>
      <div class="input-group"><label>Current Trophies</label><input type="number" id="trophies-${i}" value="800" min="0"></div>
      <div class="input-group"><label>Match Score</label><input type="number" id="score-${i}" value="${Math.max(1, total - i + 1) * 10}" step="any"></div>
      <div class="input-group"><label>Match Status</label>
        <select id="status-${i}">
          <option value="COMPLETED" selected>COMPLETED</option>
          <option value="ABANDONED">ABANDONED</option>
          <option value="FORFEITED">FORFEITED</option>
        </select>
      </div>
      <div class="input-group"><label>Tier</label>
        <select id="tier-${i}" class="player-tier-select">
          <option value="">— None —</option>${tierOptions}
        </select>
      </div>
    `;
    playersGrid.appendChild(card);
  }
}

// ── Config getters ────────────────────────────────────────
function getBaseConfig() {
  return {
    entryFee:    parseFloat(document.getElementById('entryFee').value) || 0,
    currency:    document.getElementById('currencyType').value,
    rakePercent: parseFloat(document.getElementById('rakePercent').value) || 0,
  };
}

function getEloConfig() {
  return {
    scalingFactor: parseFloat(document.getElementById('scalingFactor').value) || 400,
    kFactor:       parseFloat(document.getElementById('kFactor').value) || 32,
    strategy:      'PAIRWISE_AVERAGE_RANK',
    roundMode:     document.getElementById('eloRoundMode').value,
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
    strategy:    'DYNAMIC_SLIDING_SCALE',
    roundMode:   document.getElementById('trophyRoundMode').value,
  };
}

function getRankConfig(total) {
  const arr = [];
  for (let rank = 1; rank <= total; rank++) {
    arr.push({
      rank,
      poolSharePercent: parseFloat(document.getElementById(`rank-share-${rank}`).value) || 0,
      bonusAmount:      parseFloat(document.getElementById(`rank-bonus-amount-${rank}`).value) || 0,
      bonusTrophies:    parseFloat(document.getElementById(`rank-bonus-trophy-${rank}`).value) || 0,
    });
  }
  return arr;
}

function collectPlayers(total) {
  const arr = [];
  for (let i = 1; i <= total; i++) {
    arr.push({
      playerId:       `Player ${i}`,
      currentElo:     parseFloat(document.getElementById(`elo-${i}`).value) || 0,
      currentTrophies: parseFloat(document.getElementById(`trophies-${i}`).value) || 0,
      matchScore:     parseFloat(document.getElementById(`score-${i}`).value) || 0,
      matchStatus:    document.getElementById(`status-${i}`).value,
      tierName:       document.getElementById(`tier-${i}`).value || '',
    });
  }
  return arr;
}

// ── Render Results ────────────────────────────────────────
function formatDelta(v) { return v > 0 ? `+${v}` : `${v}`; }

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
    const eloClass    = r.eloDelta > 0 ? 'val-positive' : r.eloDelta < 0 ? 'val-negative' : 'val-zero';
    const trophClass  = r.formulaTrophyDelta > 0 ? 'val-positive' : r.formulaTrophyDelta < 0 ? 'val-negative' : 'val-zero';
    const tierClass   = r.tierTrophyDelta > 0 ? 'val-positive' : r.tierTrophyDelta < 0 ? 'val-negative' : 'val-zero';
    const statusClass = r.matchStatus === 'COMPLETED' ? 'status-completed' : 'status-other';
    const tierBadge   = r.tierName && r.tierName !== '—'
      ? `<span class="tier-badge tier-badge-${r.tierName.toLowerCase()}">${r.tierName}</span>` : '<span class="val-zero">—</span>';

    tr.innerHTML = `
      <td><div class="player-cell"><div class="p-avatar">${r.playerId.replace('Player ','')}</div><span class="p-name">${r.playerId}</span></div></td>
      <td class="rank-cell">${r.rank}</td>
      <td><span class="status-chip ${statusClass}">${r.matchStatus}</span></td>
      <td>${tierBadge}</td>
      <td>${r.oldElo}</td>
      <td>${r.actualScore.toFixed(4)}</td>
      <td>${r.expectedScore.toFixed(4)}</td>
      <td class="elo-change-cell"><span class="${eloClass}">${formatDelta(r.eloDelta)}</span></td>
      <td>${r.newElo}</td>
      <td class="trophy-change-cell"><span class="${trophClass}">${formatDelta(r.formulaTrophyDelta)}</span></td>
      <td class="tier-trophy-cell"><span class="${tierClass}">${formatDelta(r.tierTrophyDelta)}</span></td>
      <td>${r.bonusTrophies > 0 ? `<span class="val-positive">+${r.bonusTrophies}</span>` : '<span class="val-zero">0</span>'}</td>
      <td>${r.newTrophies}</td>
      <td class="pool-cell">${r.poolAmount > 0 ? `+${r.poolAmount}` : '<span class="val-zero">0</span>'}</td>
      <td>${r.bonusAmount > 0 ? `+${r.bonusAmount}` : '<span class="val-zero">0</span>'}</td>
      <td>${r.totalAmount > 0 ? `+${r.totalAmount}` : '<span class="val-zero">0</span>'}</td>
    `;
    resultsTbody.appendChild(tr);
  });
}

// ── Export ────────────────────────────────────────────────
function buildExportPayload(meta, results) {
  return {
    simulation: { generatedAt: new Date().toISOString(), platform: 'Battlebucks Match Simulator' },
    configuration: {
      baseConfig:   meta.baseConfig,
      eloConfig:    meta.eloConfig,
      trophyConfig: meta.trophyConfig,
      rankConfig:   meta.rankConfig,
      tiers:        meta.tiers,
      safetyConfig: meta.safetyConfig,
    },
    playerInputs: meta.playerInputs,
    results: results.map(r => ({
      playerId: r.playerId, matchStatus: r.matchStatus, matchScore: r.matchScore,
      tierName: r.tierName, rank: r.rank,
      oldElo: r.oldElo,
      actualScore:   Number(r.actualScore.toFixed(4)),
      expectedScore: Number(r.expectedScore.toFixed(4)),
      eloDelta: r.eloDelta, newElo: r.newElo,
      winTrophy:  Number(r.winTrophy.toFixed(4)),
      lossTrophy: Number(r.lossTrophy.toFixed(4)),
      formulaTrophyDelta: r.formulaTrophyDelta,
      tierTrophyDelta:    r.tierTrophyDelta,
      bonusTrophies: r.bonusTrophies, newTrophies: r.newTrophies,
      poolAmount: r.poolAmount, bonusAmount: r.bonusAmount, totalAmount: r.totalAmount,
      currency: r.currency, grossPool: r.grossPool,
      rakePercent: r.rakePercent, rakeAmount: r.rakeAmount,
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

// ── Events ────────────────────────────────────────────────
btnAddTier.addEventListener('click', () => {
  const idx = tierConfigBody.rows.length;
  addTierRow({ name: '', positiveMultiplier: 1.0, negativeMultiplier: 1.0 }, idx);
});

btnCopyJson.addEventListener('click', async () => {
  if (!lastExportPayload) return showToast('No results to copy.', 'error');
  const txt = JSON.stringify(lastExportPayload, null, 2);
  try { await navigator.clipboard.writeText(txt); } catch {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  showToast('JSON copied to clipboard!', 'success');
});

btnDownloadPdf.addEventListener('click', () => {
  if (!lastExportPayload) return showToast('No results to export.', 'error');
  showToast('PDF export not updated yet — use Copy JSON.', 'error');
});

btnCompute.addEventListener('click', () => {
  try {
    const total       = currentTotalPlayers;
    const baseConfig  = getBaseConfig();
    const eloConfig   = getEloConfig();
    const trophyConfig = getTrophyConfig();
    const rankConfig  = getRankConfig(total);
    const tiers       = getTiers();
    const safetyConfig = getSafetyConfig();
    const playerInputs = collectPlayers(total);
    const config = { baseConfig, eloConfig, trophyConfig, rankConfig, tiers, safetyConfig };
    const results = resolveMatch(playerInputs, config);

    const meta = { total, baseConfig, eloConfig, trophyConfig, rankConfig, tiers, safetyConfig,
      kFactor: eloConfig.kFactor, scalingFactor: eloConfig.scalingFactor, playerInputs };

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

// ── Init ──────────────────────────────────────────────────
buildTierConfigInputs(DEFAULT_TIERS);
buildPlayerInputs(currentTotalPlayers);
buildRankConfigInputs(currentTotalPlayers);