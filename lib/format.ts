/** US dollars, with more precision for the small amounts per edition. */
export function formatUsd(n: number) {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(n < 1 ? 3 : 2)}`;
}
