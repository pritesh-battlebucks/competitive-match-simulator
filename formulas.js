function applyRound(value, mode) {
  switch (mode) {
    case 'FLOOR': return Math.floor(value);
    case 'CEIL': return Math.ceil(value);
    case 'NEAREST':
    default: return Math.round(value);
  }
}

function getRankRewardConfig(rankConfigs, rank) {
  return rankConfigs.find(r => r.rank === rank) ?? {
    rank,
    poolSharePercent: 0,
    bonusAmount: 0,
    bonusTrophies: 0,
  };
}

function assignRanks(players) {
  const n = players.length;
  const completed = players.filter(p => p.matchStatus === 'COMPLETED');
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

function calculateActualScore(rank, totalPlayers) {
  if (totalPlayers < 2) throw new Error('totalPlayers must be at least 2');
  if (rank < 1 || rank > totalPlayers) throw new Error(`rank must be between 1 and ${totalPlayers}`);
  return (totalPlayers - rank) / (totalPlayers - 1);
}

function calculateExpectedScoreVsOpponent(playerElo, opponentElo, scalingFactor = 400) {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / scalingFactor));
}

function calculateExpectedScore(playerElo, opponentElos, scalingFactor = 400) {
  if (!opponentElos.length) throw new Error('opponentElos must not be empty');
  const total = opponentElos.reduce((sum, elo) => sum + calculateExpectedScoreVsOpponent(playerElo, elo, scalingFactor), 0);
  return total / opponentElos.length;
}

function calculateEloDelta(actualScore, expectedScore, kFactor = 32) {
  return kFactor * (actualScore - expectedScore);
}

function calculateWinTrophy(expectedScore, trophyConfig) {
  const { maxPositive, midPositive, lowPositive } = trophyConfig.winZone;
  if (expectedScore < 0.5) {
    const pct = expectedScore * 2;
    return maxPositive - pct * (maxPositive - midPositive);
  }
  const pct = (expectedScore - 0.5) * 2;
  return midPositive - pct * (midPositive - lowPositive);
}

function calculateLossTrophy(expectedScore, trophyConfig) {
  const { lowNegative, midNegative, maxNegative } = trophyConfig.lossZone;
  if (expectedScore < 0.5) {
    const pct = expectedScore * 2;
    return lowNegative - pct * (lowNegative - midNegative);
  }
  const pct = (expectedScore - 0.5) * 2;
  return midNegative - pct * (midNegative - maxNegative);
}

function blendTrophyByActualScore(actualScore, winTrophy, lossTrophy, roundMode = 'NEAREST') {
  const raw = lossTrophy + actualScore * (winTrophy - lossTrophy);
  return applyRound(raw, roundMode);
}

function isFullTie(players) {
  const allCompleted = players.every(p => p.matchStatus === 'COMPLETED');
  if (!allCompleted || players.length < 2) return false;
  const refScore = players[0].matchScore;
  return players.every(p => p.matchScore === refScore);
}

function computeRankRewards(startRank, groupSize, rankConfigs, distributablePool) {
  let sumPoolPct = 0;
  let sumBonusAmount = 0;
  let sumBonusTrophies = 0;

  for (let slot = startRank; slot < startRank + groupSize; slot++) {
    const rc = getRankRewardConfig(rankConfigs, slot);
    sumPoolPct += rc.poolSharePercent;
    sumBonusAmount += rc.bonusAmount;
    sumBonusTrophies += rc.bonusTrophies;
  }

  return {
    poolAmount: Math.floor((distributablePool * sumPoolPct) / 100 / groupSize),
    bonusAmount: Math.floor(sumBonusAmount / groupSize),
    bonusTrophies: Math.round(sumBonusTrophies / groupSize),
  };
}

function computeFullTieRewards(rankConfigs, distributablePool, n) {
  const totalBonusAmount = rankConfigs.reduce((s, r) => s + r.bonusAmount, 0);
  const totalBonusTrophies = rankConfigs.reduce((s, r) => s + r.bonusTrophies, 0);
  return {
    poolAmount: Math.floor(distributablePool / n),
    bonusAmount: Math.floor(totalBonusAmount / n),
    bonusTrophies: Math.round(totalBonusTrophies / n),
  };
}

function resolveMatch(playerInputs, config) {
  if (playerInputs.length < 2) throw new Error('A match requires at least 2 players');

  const n = playerInputs.length;
  const { baseConfig, eloConfig, trophyConfig, rankConfig } = config;
  const rankedPlayers = assignRanks(playerInputs);
  const fullTie = isFullTie(playerInputs);

  const rankGroups = new Map();
  for (const p of rankedPlayers) {
    if (!rankGroups.has(p.rank)) rankGroups.set(p.rank, []);
    rankGroups.get(p.rank).push(p);
  }

  const rawById = new Map();
  for (const player of rankedPlayers) {
    const opponentElos = rankedPlayers.filter(p => p.playerId !== player.playerId).map(p => p.currentElo);
    const actualScore = calculateActualScore(player.rank, n);
    const expectedScore = calculateExpectedScore(player.currentElo, opponentElos, eloConfig.scalingFactor);
    const eloDelta = applyRound(calculateEloDelta(actualScore, expectedScore, eloConfig.kFactor), eloConfig.roundMode);
    const winTrophy = calculateWinTrophy(expectedScore, trophyConfig);
    const lossTrophy = calculateLossTrophy(expectedScore, trophyConfig);
    const formulaTrophyDelta = blendTrophyByActualScore(actualScore, winTrophy, lossTrophy, trophyConfig.roundMode);

    rawById.set(player.playerId, {
      actualScore,
      expectedScore,
      eloDelta,
      winTrophy,
      lossTrophy,
      formulaTrophyDelta,
    });
  }

  const trophyDeltaByRank = new Map();
  for (const [rank, group] of rankGroups) {
    const highest = Math.max(...group.map(p => rawById.get(p.playerId).formulaTrophyDelta));
    trophyDeltaByRank.set(rank, highest);
  }

  const grossPool = baseConfig.entryFee * n;
  const rakeAmount = fullTie ? 0 : Math.floor(grossPool * baseConfig.rakePercent / 100);
  const distributablePool = grossPool - rakeAmount;

  return playerInputs.map(input => {
    const ranked = rankedPlayers.find(p => p.playerId === input.playerId);
    const raw = rawById.get(input.playerId);
    const groupSize = rankGroups.get(ranked.rank).length;

    const eloDelta = fullTie ? 0 : raw.eloDelta;

    let formulaTrophyFinal;
    if (fullTie) formulaTrophyFinal = trophyConfig.tieTrophies;
    else if (groupSize > 1) formulaTrophyFinal = trophyDeltaByRank.get(ranked.rank);
    else formulaTrophyFinal = raw.formulaTrophyDelta;

    const rewards = fullTie
      ? computeFullTieRewards(rankConfig, distributablePool, n)
      : computeRankRewards(ranked.rank, groupSize, rankConfig, distributablePool);

    return {
      playerId: input.playerId,
      matchStatus: input.matchStatus,
      matchScore: input.matchScore,
      rank: ranked.rank,

      oldElo: input.currentElo,
      actualScore: raw.actualScore,
      expectedScore: raw.expectedScore,
      eloDelta,
      newElo: input.currentElo + eloDelta,

      oldTrophies: input.currentTrophies,
      winTrophy: raw.winTrophy,
      lossTrophy: raw.lossTrophy,
      formulaTrophyDelta: formulaTrophyFinal,
      bonusTrophies: rewards.bonusTrophies,
      newTrophies: input.currentTrophies + formulaTrophyFinal + rewards.bonusTrophies,

      poolAmount: rewards.poolAmount,
      bonusAmount: rewards.bonusAmount,
      totalAmount: rewards.poolAmount + rewards.bonusAmount,

      currency: baseConfig.currency,
      entryFee: baseConfig.entryFee,
      grossPool,
      rakePercent: baseConfig.rakePercent,
      rakeAmount,
      distributablePool,
    };
  });
}

function resolveDrawMatch(playerInputs, config) {
  const n = playerInputs.length;
  return playerInputs.map(input => ({
    playerId: input.playerId,
    matchStatus: input.matchStatus,
    matchScore: input.matchScore,
    rank: n,
    oldElo: input.currentElo,
    actualScore: 0,
    expectedScore: 0,
    eloDelta: 0,
    newElo: input.currentElo,
    oldTrophies: input.currentTrophies,
    winTrophy: 0,
    lossTrophy: 0,
    formulaTrophyDelta: 0,
    bonusTrophies: 0,
    newTrophies: input.currentTrophies,
    poolAmount: 0,
    bonusAmount: 0,
    totalAmount: 0,
    currency: config?.baseConfig?.currency ?? 'COINS',
    entryFee: config?.baseConfig?.entryFee ?? 0,
    grossPool: 0,
    rakePercent: config?.baseConfig?.rakePercent ?? 0,
    rakeAmount: 0,
    distributablePool: 0,
  }));
}