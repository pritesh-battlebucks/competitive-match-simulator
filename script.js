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

// ---- State ----
let currentTotalPlayers = 6;
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

  // Results are already sorted by score (descending) since we sorted matchPlayers
  renderResults(results, { kFactor, scalingFactor, total, trophyConfig });

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