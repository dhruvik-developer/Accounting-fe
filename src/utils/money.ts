export function lineTotal(quantity: number, rate: number, discount: number = 0): string {
  const qty = Math.round(Number(quantity || 0) * 1000);
  const rt = Math.round(Number(rate || 0) * 100);
  const disc = Math.round(Number(discount || 0) * 100);
  const cents = Math.round((qty * rt) / 1000) - disc;
  return (cents / 100).toFixed(2);
}
