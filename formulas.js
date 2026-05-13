// =============================================================================
// Battlebucks — Elo & Trophy Formula Engine v2 (JavaScript)
// Strategy: PAIRWISE_AVERAGE_RANK (Elo) + DYNAMIC_SLIDING_SCALE (Trophy)
// =============================================================================

// ---- Rounding helper ----
function applyRound(value, mode) {
  switch (mode) {
    case 'FLOOR':   return Math.floor(value);
    case 'CEIL':    return Math.ceil(value);
    case 'NEAREST':
    default:        return Math.round(value);
  }
}

function getRakeConfig(rakeConfig) {
  return rakeConfig ?? { coinRakePercent: 0, gemRakePercent: 0, ggRakePercent: 0 };
}

// ---- Get RankRewardConfig or zero defaults ----
function getRankRewardConfig(rankConfigs, rank) {
  return rankConfigs.find(r => r.rank === rank) ?? {
    rank,
    coinSharePercent: 0, gemSharePercent: 0, ggSharePercent: 0,
    bonusCoins: 0, bonusGems: 0, bonusGG: 0, bonusTrophies: 0,
  };
}

// =============================================================================
// RANK ASSIGNMENT
// =============================================================================

/**
 * Assigns Standard Competition Ranks.
 * COMPLETED players sorted by matchScore desc.
 * Non-COMPLETED players all share rank = n (last place).
 */
function assignRanks(players) {
  const n = players.length;
  const completed    = players.filter(p => p.matchStatus === 'COMPLETED');
  const nonCompleted = players.filter(p => p.matchStatus !== 'COMPLETED');

  const sorted = [...completed].sort((a, b) => b.matchScore - a.matchScore);

  const rankedCompleted = [];
  let nextRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const sameAsPrev = i > 0 && sorted[i].matchScore === sorted[i - 1].matchScore;
    const assignedRank = sameAsPrev ? rankedCompleted[i - 1].rank : nextRank;
    rankedCompleted.push({ ...sorted[i], rank: assignedRank });
    nextRank++;
  }

  const rankedNonCompleted = nonCompleted.map(p => ({ ...p, rank: n }));

  return [...rankedCompleted, ...rankedNonCompleted];
}

// =============================================================================
// ELO PRIMITIVES
// =============================================================================

function calculateActualScore(rank, totalPlayers) {
  if (totalPlayers < 2) throw new Error('totalPlayers must be at least 2');
  if (rank < 1 || rank > totalPlayers)
    throw new Error(`rank must be between 1 and ${totalPlayers}, got ${rank}`);
  return (totalPlayers - rank) / (totalPlayers - 1);
}

function calculateExpectedScoreVsOpponent(playerElo, opponentElo, scalingFactor = 400) {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / scalingFactor));
}

function calculateExpectedScore(playerElo, opponentElos, scalingFactor = 400) {
  if (opponentElos.length === 0) throw new Error('opponentElos must not be empty');
  const total = opponentElos.reduce(
    (sum, oElo) => sum + calculateExpectedScoreVsOpponent(playerElo, oElo, scalingFactor), 0
  );
  return total / opponentElos.length;
}

function calculateEloDelta(actualScore, expectedScore, kFactor = 32) {
  return kFactor * (actualScore - expectedScore);
}

// =============================================================================
// TROPHY PRIMITIVES
// =============================================================================

function calculateWinTrophy(expectedScore, trophyConfig) {
  const { maxPositive, midPositive, lowPositive } = trophyConfig.winZone;
  if (expectedScore < 0.5) {
    const pct = expectedScore * 2;
    return maxPositive - pct * (maxPositive - midPositive);
  } else {
    const pct = (expectedScore - 0.5) * 2;
    return midPositive - pct * (midPositive - lowPositive);
  }
}

function calculateLossTrophy(expectedScore, trophyConfig) {
  const { lowNegative, midNegative, maxNegative } = trophyConfig.lossZone;
  if (expectedScore < 0.5) {
    const pct = expectedScore * 2;
    return lowNegative - pct * (lowNegative - midNegative);
  } else {
    const pct = (expectedScore - 0.5) * 2;
    return midNegative - pct * (midNegative - maxNegative);
  }
}

function blendTrophyByActualScore(actualScore, winTrophy, lossTrophy, roundMode = 'NEAREST') {
  const raw = lossTrophy + actualScore * (winTrophy - lossTrophy);
  return applyRound(raw, roundMode);
}

// =============================================================================
// TIE DETECTION
// =============================================================================

/**
 * Full tie (Case B): ALL players are COMPLETED and share the same matchScore.
 */
function isFullTie(players) {
  const allCompleted = players.every(p => p.matchStatus === 'COMPLETED');
  if (!allCompleted || players.length < 2) return false;
  const refScore = players[0].matchScore;
  return players.every(p => p.matchScore === refScore);
}

// =============================================================================
// REWARD HELPERS
// =============================================================================

/**
 * Reward bundle for a normal or partial-tie situation.
 *
 * When groupSize > 1 (partial tie), players at rank R consumed rank slots
 * R, R+1, R+2 ... R+(groupSize-1). We sum the coinSharePercent (and other
 * values) of ALL those slots, then divide evenly among the group.
 *
 * Example: rank 2 group of 3 → sum ranks 2+3+4 percents, divide by 3.
 *
 * Coins / Gems / GG splits → Math.floor (truncate remainder).
 * Trophy bonus split       → Math.round  (nearest integer).
 *
 * @param {number}   startRank   The assigned rank of the tied group (lowest rank number)
 * @param {number}   groupSize   How many players share this rank
 * @param {Array}    rankConfigs Full rankConfig array from GameModeConfig
 * @param {Object}   totalPool   { coins, gems, gg } accumulated pool
 */
function computeRankRewards(startRank, groupSize, rankConfigs, totalPool) {
  // Collect all rank slots consumed by this tie group
  let sumCoinPct = 0, sumGemPct = 0, sumGGPct = 0;
  let sumBonusCoins = 0, sumBonusGems = 0, sumBonusGG = 0, sumBonusTrophies = 0;

  for (let slot = startRank; slot < startRank + groupSize; slot++) {
    const rc = getRankRewardConfig(rankConfigs, slot);
    sumCoinPct       += rc.coinSharePercent;
    sumGemPct        += rc.gemSharePercent;
    sumGGPct         += rc.ggSharePercent;
    sumBonusCoins    += rc.bonusCoins;
    sumBonusGems     += rc.bonusGems;
    sumBonusGG       += rc.bonusGG;
    sumBonusTrophies += rc.bonusTrophies;
  }

  return {
    poolCoins:     Math.floor((totalPool.coins * sumCoinPct)    / 100 / groupSize),
    poolGems:      Math.floor((totalPool.gems  * sumGemPct)     / 100 / groupSize),
    poolGG:        Math.floor((totalPool.gg    * sumGGPct)      / 100 / groupSize),
    bonusCoins:    Math.floor(sumBonusCoins    / groupSize),
    bonusGems:     Math.floor(sumBonusGems     / groupSize),
    bonusGG:       Math.floor(sumBonusGG       / groupSize),
    bonusTrophies: Math.round(sumBonusTrophies / groupSize),
  };
}

function computeFullTieRewards(allRankConfigs, totalPool, n) {
  const totalBonusCoins    = allRankConfigs.reduce((s, r) => s + r.bonusCoins,    0);
  const totalBonusGems     = allRankConfigs.reduce((s, r) => s + r.bonusGems,     0);
  const totalBonusGG       = allRankConfigs.reduce((s, r) => s + r.bonusGG,       0);
  const totalBonusTrophies = allRankConfigs.reduce((s, r) => s + r.bonusTrophies, 0);

  return {
    poolCoins:     Math.floor(totalPool.coins / n),
    poolGems:      Math.floor(totalPool.gems  / n),
    poolGG:        Math.floor(totalPool.gg    / n),
    bonusCoins:    Math.floor(totalBonusCoins    / n),
    bonusGems:     Math.floor(totalBonusGems     / n),
    bonusGG:       Math.floor(totalBonusGG       / n),
    bonusTrophies: Math.round(totalBonusTrophies / n),
  };
}

// =============================================================================
// MAIN: resolveMatch
// =============================================================================

/**
 * Resolves a complete match — Elo, Trophy, and Reward changes for all players.
 *
 * @param {Array}  playerInputs   Players with currentElo, currentTrophies, matchScore, matchStatus
 * @param {Object} config         { eloConfig, trophyConfig, rankConfig }
 * @param {Object} entryFee       { coins, gems, gg } per player (default 0)
 * @returns {Array}               One result object per player (input order preserved)
 */
function resolveMatch(playerInputs, config, entryFee = { coins: 0, gems: 0, gg: 0 }) {
  if (playerInputs.length < 2) throw new Error('A match requires at least 2 players');

  const n = playerInputs.length;
  const { eloConfig, trophyConfig, rankConfig } = config;

  // 1. Assign ranks
  const rankedPlayers = assignRanks(playerInputs);

  // 2. Detect full tie
  const fullTie = isFullTie(playerInputs);

  // 3. Build rank-group map: rank → [players]
  const rankGroups = new Map();
  for (const p of rankedPlayers) {
    if (!rankGroups.has(p.rank)) rankGroups.set(p.rank, []);
    rankGroups.get(p.rank).push(p);
  }

  // 4. Compute raw formula values per player
  const rawById = new Map();
  for (const player of rankedPlayers) {
    const opponentElos = rankedPlayers
      .filter(p => p.playerId !== player.playerId)
      .map(p => p.currentElo);

    const actualScore   = calculateActualScore(player.rank, n);
    const expectedScore = calculateExpectedScore(player.currentElo, opponentElos, eloConfig.scalingFactor);
    const eloDelta = applyRound(
  calculateEloDelta(actualScore, expectedScore, eloConfig.kFactor),
  eloConfig.roundMode
);

    const winTrophy          = calculateWinTrophy(expectedScore, trophyConfig);
    const lossTrophy         = calculateLossTrophy(expectedScore, trophyConfig);
    const formulaTrophyDelta = blendTrophyByActualScore(actualScore, winTrophy, lossTrophy, trophyConfig.roundMode);

    rawById.set(player.playerId, {
      actualScore, expectedScore, eloDelta,
      winTrophy, lossTrophy, formulaTrophyDelta,
    });
  }

  // 5. Partial-tie trophy override: highest formulaTrophyDelta within rank group
  const trophyDeltaByRank = new Map();
  for (const [rank, group] of rankGroups) {
    const highest = Math.max(...group.map(p => rawById.get(p.playerId).formulaTrophyDelta));
    trophyDeltaByRank.set(rank, highest);
  }

  // ── 6. Compute total reward pool (after rake deduction) ──────────────────
const rake = getRakeConfig(config.rakeConfig);

const grossPool = {
  coins: entryFee.coins * n,
  gems:  entryFee.gems  * n,
  gg:    entryFee.gg    * n,
};

const rakeAmount = {
  coins: fullTie ? 0 : Math.floor(grossPool.coins * rake.coinRakePercent / 100),
  gems:  fullTie ? 0 : Math.floor(grossPool.gems  * rake.gemRakePercent  / 100),
  gg:    fullTie ? 0 : Math.floor(grossPool.gg    * rake.ggRakePercent   / 100),
};

const totalPool = {
  coins: grossPool.coins - rakeAmount.coins,
  gems:  grossPool.gems  - rakeAmount.gems,
  gg:    grossPool.gg    - rakeAmount.gg,
};

  // 7. Assemble results (preserve input order)
  return playerInputs.map(input => {
    const ranked    = rankedPlayers.find(p => p.playerId === input.playerId);
    const raw       = rawById.get(input.playerId);
    const groupSize = rankGroups.get(ranked.rank).length;

    const eloDelta = fullTie ? 0 : raw.eloDelta;

    let trophyDelta;
    if (fullTie) {
      trophyDelta = trophyConfig.tieTrophies;
    } else if (groupSize > 1) {
      trophyDelta = trophyDeltaByRank.get(ranked.rank);
    } else {
      trophyDelta = raw.formulaTrophyDelta;
    }

    const rewards = fullTie
  ? computeFullTieRewards(rankConfig, totalPool, n)
  : computeRankRewards(ranked.rank, groupSize, rankConfig, totalPool);

    return {
      playerId:    input.playerId,
      matchStatus: input.matchStatus,
      matchScore:  input.matchScore,
      rank:        ranked.rank,

      oldElo:        input.currentElo,
      actualScore:   raw.actualScore,
      expectedScore: raw.expectedScore,
      eloDelta,
      newElo:        input.currentElo + eloDelta,

      winTrophy:  raw.winTrophy,
      lossTrophy: raw.lossTrophy,
      oldTrophies:        input.currentTrophies,
      formulaTrophyDelta: raw.formulaTrophyDelta,
      trophyDelta,
      bonusTrophies:      rewards.bonusTrophies,
      newTrophies:        input.currentTrophies + trophyDelta + rewards.bonusTrophies,

      poolCoins:  rewards.poolCoins,
      poolGems:   rewards.poolGems,
      poolGG:     rewards.poolGG,
      bonusCoins: rewards.bonusCoins,
      bonusGems:  rewards.bonusGems,
      bonusGG:    rewards.bonusGG,
      totalCoins: rewards.poolCoins + rewards.bonusCoins,
      totalGems:  rewards.poolGems  + rewards.bonusGems,
      totalGG:    rewards.poolGG    + rewards.bonusGG,
      grossPoolCoins: grossPool.coins,
grossPoolGems:  grossPool.gems,
grossPoolGG:    grossPool.gg,
rakeCoins:      rakeAmount.coins,
rakeGems:       rakeAmount.gems,
rakeGG:         rakeAmount.gg,
netPoolCoins:   totalPool.coins,
netPoolGems:    totalPool.gems,
netPoolGG:      totalPool.gg,
    };
  });
}

// =============================================================================
// DRAW (explicit server-declared draw — no trophies, no rewards)
// =============================================================================

function resolveDrawMatch(playerInputs) {
  const n = playerInputs.length;
  return playerInputs.map(input => ({
    playerId: input.playerId, matchStatus: input.matchStatus,
    matchScore: input.matchScore, rank: n,
    oldElo: input.currentElo, actualScore: 0, expectedScore: 0,
    eloDelta: 0, newElo: input.currentElo,
    oldTrophies: input.currentTrophies, formulaTrophyDelta: 0,
    trophyDelta: 0, bonusTrophies: 0, newTrophies: input.currentTrophies,
    poolCoins: 0, poolGems: 0, poolGG: 0,
    bonusCoins: 0, bonusGems: 0, bonusGG: 0,
    totalCoins: 0, totalGems: 0, totalGG: 0,
  }));
}

// =============================================================================
// PRESET CONFIGS
// =============================================================================

const DEFAULT_ELO_CONFIG = {
  scalingFactor: 400, kFactor: 32,
  strategy: 'PAIRWISE_AVERAGE_RANK', roundMode: 'NEAREST',
};

const TROPHY_CONFIG_2_PLAYER = {
  winZone:  { maxPositive: 8,  midPositive: 6,  lowPositive: 3  },
  lossZone: { lowNegative: -2, midNegative: -4, maxNegative: -6 },
  tieTrophies: 3, strategy: 'DYNAMIC_SLIDING_SCALE', roundMode: 'NEAREST',
};

const TROPHY_CONFIG_6_PLAYER = {
  winZone:  { maxPositive: 40, midPositive: 25, lowPositive: 10  },
  lossZone: { lowNegative: -10, midNegative: -25, maxNegative: -40 },
  tieTrophies: 5, strategy: 'DYNAMIC_SLIDING_SCALE', roundMode: 'NEAREST',
};