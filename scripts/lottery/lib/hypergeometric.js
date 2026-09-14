/**
 * Exact multivariate-hypergeometric profit-probability calculator.
 *
 * A scratch game's *remaining* population is a finite, fixed set of tickets:
 * some number remaining in each prize tier, plus a "non-winning" bucket that
 * makes up the rest of the remaining print run. Buying N tickets is drawing N
 * items from that finite population *without replacement* -- so the right
 * model is the multivariate hypergeometric distribution, not N independent
 * per-ticket draws (independence overstates variance and gets the profit
 * probability wrong, especially as N approaches a meaningful fraction of a
 * thin remaining pool).
 *
 * Approach: build the exact joint distribution of (tickets drawn so far,
 * total prize value so far) via DP over categories, using unnormalized
 * integer weights (products of exact binomial coefficients, via BigInt to
 * avoid float precision loss), then normalize by C(populationSize, N) at the
 * end. This is exact -- no simulation, no independence approximation.
 */

function bigC(n, k) {
  if (k < 0 || k > n) return 0n;
  n = BigInt(n);
  k = BigInt(k);
  if (k > n - k) k = n - k;
  let num = 1n;
  let den = 1n;
  for (let i = 0n; i < k; i++) {
    num *= n - i;
    den *= i + 1n;
  }
  return num / den;
}

/**
 * @param {Array<{value:number, remaining:number}>} tiers - winning tiers only
 *   (value = prize amount in dollars, remaining = count of that prize still
 *   unclaimed in the population). Do not include a "non-winner" row here.
 * @param {number} remainingTickets - total tickets remaining in the game
 *   (winners across all tiers + non-winners).
 * @param {number} n - number of tickets being bought (drawn without
 *   replacement from remainingTickets).
 * @returns {Map<number, bigint>} unnormalized weight per total-value outcome,
 *   plus a `total` BigInt (C(remainingTickets, n)) attached as a property.
 */
export function drawDistribution(tiers, remainingTickets, n) {
  const winnersTotal = tiers.reduce((s, t) => s + t.remaining, 0);
  if (winnersTotal > remainingTickets) {
    throw new Error("sum of remaining prize counts exceeds remainingTickets");
  }
  const nonWinners = remainingTickets - winnersTotal;
  const categories = [...tiers.map((t) => ({ value: t.value, size: t.remaining })), { value: 0, size: nonWinners }];

  // dp: Map<ticketsDrawn, Map<totalValue, weight>>
  let dp = new Map([[0, new Map([[0, 1n]])]]);

  for (const cat of categories) {
    const next = new Map();
    for (const [drawnSoFar, valueMap] of dp) {
      const maxK = Math.min(cat.size, n - drawnSoFar);
      for (let k = 0; k <= maxK; k++) {
        const coeff = bigC(cat.size, k);
        if (coeff === 0n) continue;
        const newDrawn = drawnSoFar + k;
        if (!next.has(newDrawn)) next.set(newDrawn, new Map());
        const destMap = next.get(newDrawn);
        for (const [value, weight] of valueMap) {
          const newValue = value + k * cat.value;
          destMap.set(newValue, (destMap.get(newValue) || 0n) + weight * coeff);
        }
      }
    }
    dp = next;
  }

  const finalMap = dp.get(n) || new Map();
  finalMap.total = bigC(remainingTickets, n);
  return finalMap;
}

/**
 * Probability that buying n tickets nets a strict profit (total prize value
 * > total amount spent), using the exact distribution from drawDistribution.
 *
 * @returns {{profitProbability:number, breakEvenProbability:number, lossProbability:number, expectedValue:number}}
 */
export function profitStats(tiers, remainingTickets, ticketPrice, n) {
  const dist = drawDistribution(tiers, remainingTickets, n);
  const spend = n * ticketPrice;
  let profitWeight = 0n;
  let breakEvenWeight = 0n;
  let lossWeight = 0n;
  let evNumerator = 0n; // sum(value * weight), divided by total at the end
  for (const [value, weight] of dist) {
    evNumerator += BigInt(value) * weight;
    if (value > spend) profitWeight += weight;
    else if (value === spend) breakEvenWeight += weight;
    else lossWeight += weight;
  }
  const total = dist.total;
  return {
    profitProbability: Number(profitWeight) / Number(total),
    breakEvenProbability: Number(breakEvenWeight) / Number(total),
    lossProbability: Number(lossWeight) / Number(total),
    expectedValue: Number(evNumerator) / Number(total),
  };
}
