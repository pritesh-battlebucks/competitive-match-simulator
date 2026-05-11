// =============================================================================
// Battlebucks — Elo & Trophy Formula Engine (JavaScript)
// =============================================================================

/**
 * STEP 1A — Actual Score (S)
 * Formula: S = (n − rank) / (n − 1)
 */
function calculateActualScore(rank, totalPlayers) {
  if (totalPlayers < 2) throw new Error("totalPlayers must be at least 2");
  if (rank < 1 || rank > totalPlayers)
    throw new Error(`rank must be between 1 and ${totalPlayers}, got ${rank}`);
  return (totalPlayers - rank) / (totalPlayers - 1);
}

/**
 * STEP 1B — 1v1 Expected Score vs a single opponent
 * Formula: 1 / (1 + 10 ^ ((opponentElo − playerElo) / scalingFactor))
 */
function calculateExpectedScoreVsOpponent(playerElo, opponentElo, scalingFactor = 400) {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / scalingFactor));
}

/**
 * STEP 1B (Full) — Expected Score (E) averaged across all opponents
 */
function calculateExpectedScore(playerElo, opponentElos, scalingFactor = 400) {
  if (opponentElos.length === 0) throw new Error("opponentElos must not be empty");
  const total = opponentElos.reduce(
    (sum, opponentElo) =>
      sum + calculateExpectedScoreVsOpponent(playerElo, opponentElo, scalingFactor),
    0
  );
  return total / opponentElos.length;
}

/**
 * Elo Delta
 * Formula: ΔElo = K × (S − E)
 */
function calculateEloDelta(actualScore, expectedScore, kFactor = 32) {
  return kFactor * (actualScore - expectedScore);
}

/**
 * STEP 2A — Win Trophy (piecewise linear interpolation on positive anchors)
 */
function calculateWinTrophy(expectedScore, config) {
  if (expectedScore < 0.5) {
    const percentage = expectedScore * 2;
    return config.maxPos - percentage * (config.maxPos - config.midPos);
  } else {
    const percentage = (expectedScore - 0.5) * 2;
    return config.midPos - percentage * (config.midPos - config.lowPos);
  }
}

/**
 * STEP 2B — Loss Trophy (piecewise linear interpolation on negative anchors)
 */
function calculateLossTrophy(expectedScore, config) {
  if (expectedScore < 0.5) {
    const percentage = expectedScore * 2;
    return config.lowNeg - percentage * (config.lowNeg - config.midNeg);
  } else {
    const percentage = (expectedScore - 0.5) * 2;
    return config.midNeg - percentage * (config.midNeg - config.maxNeg);
  }
}

/**
 * STEP 2C — Blend using Actual Score S
 * Formula: round( LossTrophy + S × (WinTrophy − LossTrophy) )
 */
function blendTrophyByActualScore(actualScore, winTrophy, lossTrophy) {
  const raw = lossTrophy + actualScore * (winTrophy - lossTrophy);
  return Math.round(raw);
}

/**
 * Full Match Resolution — computes Elo + Trophy for all players
 */
function resolveMatch(players, trophyConfig, kFactor = 32, scalingFactor = 400) {
  if (players.length < 2) throw new Error("A match requires at least 2 players");

  const n = players.length;

  return players.map((player) => {
    const opponentElos = players
      .filter((p) => p.playerId !== player.playerId)
      .map((p) => p.currentElo);

    const actualScore = calculateActualScore(player.rank, n);
    const expectedScore = calculateExpectedScore(player.currentElo, opponentElos, scalingFactor);

    const eloDelta = calculateEloDelta(actualScore, expectedScore, kFactor);

    const winTrophy = calculateWinTrophy(expectedScore, trophyConfig);
    const lossTrophy = calculateLossTrophy(expectedScore, trophyConfig);
    const trophyDelta = blendTrophyByActualScore(actualScore, winTrophy, lossTrophy);

    return {
      playerId: player.playerId,
      actualScore,
      expectedScore,
      oldElo: player.currentElo,
      newElo: player.currentElo + eloDelta,
      eloDelta,
      winTrophy,
      lossTrophy,
      oldTrophies: player.currentTrophies,
      newTrophies: player.currentTrophies + trophyDelta,
      trophyDelta,
    };
  });
}

/**
 * Draw Match Resolution — all deltas zero
 */
function resolveDrawMatch(players) {
  return players.map((player) => ({
    playerId: player.playerId,
    actualScore: 0,
    expectedScore: 0,
    oldElo: player.currentElo,
    newElo: player.currentElo,
    eloDelta: 0,
    winTrophy: 0,
    lossTrophy: 0,
    oldTrophies: player.currentTrophies,
    newTrophies: player.currentTrophies,
    trophyDelta: 0,
  }));
}

// Preset Configs
const TROPHY_CONFIG_2_PLAYER = {
  maxPos: 8, midPos: 6, lowPos: 3,
  lowNeg: -2, midNeg: -4, maxNeg: -6,
};

const TROPHY_CONFIG_6_PLAYER = {
  maxPos: 40, midPos: 25, lowPos: 10,
  lowNeg: -10, midNeg: -25, maxNeg: -40,
};