/**
 * Expected-value math for a WA Lottery scratch game, from its published
 * prize-tier table (prize amount, total printed at launch, remaining).
 *
 * WA Lottery's site does not publish a "tickets remaining" number directly.
 * The standard estimation method (also used by third-party trackers) backs
 * it into the published overall odds:
 *
 *   overallOddsDenominator = totalTicketsPrinted / totalWinningTicketsAtLaunch
 *
 * so, holding that ratio constant as tickets are sold/redeemed:
 *
 *   remainingTickets ≈ remainingWinningTickets * overallOddsDenominator
 *
 * This is an approximation (it assumes winners are being claimed at the same
 * rate as the ticket pool is being depleted, which is roughly but not
 * exactly true), and is the best that can be done without WA Lottery
 * publishing a live remaining-ticket count.
 */

export function deriveRemainingTickets(tiers, overallOddsDenominator) {
  const remainingWinners = tiers.reduce((s, t) => s + t.remaining, 0);
  return Math.round(remainingWinners * overallOddsDenominator);
}

export function deriveTotalTicketsPrinted(tiers, overallOddsDenominator) {
  const totalWinnersAtLaunch = tiers.reduce((s, t) => s + t.totalPrinted, 0);
  return Math.round(totalWinnersAtLaunch * overallOddsDenominator);
}

/**
 * @param {Array<{value:number, totalPrinted:number, remaining:number}>} tiers
 * @param {number} ticketPrice
 * @param {number} overallOddsDenominator - "overall odds of winning any prize
 *   are 1 in X" as published by the lottery for this game.
 */
export function computeGameStats(game) {
  const { tiers, ticketPrice, overallOddsDenominator } = game;
  const remainingTickets = deriveRemainingTickets(tiers, overallOddsDenominator);
  const remainingPrizeValue = tiers.reduce((s, t) => s + t.value * t.remaining, 0);
  const evPerTicket = remainingPrizeValue / remainingTickets;
  const evPercent = evPerTicket / ticketPrice;
  return {
    name: game.name,
    id: game.id,
    ticketPrice,
    remainingTickets,
    remainingPrizeValue,
    evPerTicket,
    evPercent,
    tiers,
  };
}

export function rankGamesByEV(games) {
  return games.map(computeGameStats).sort((a, b) => b.evPercent - a.evPercent);
}
