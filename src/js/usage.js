// Most-opened shortcuts rise to the front. Occupied cells swap among themselves, so
// empty cells keep their positions, and equal counts keep their current order.
export function sortByUsage(cards) {
  const spots = [];
  cards.forEach((card, i) => { if (card) spots.push(i); });
  const sorted = spots.map((i) => cards[i]).sort((a, b) => (b.opens || 0) - (a.opens || 0));
  spots.forEach((spot, n) => { cards[spot] = sorted[n]; });
}
