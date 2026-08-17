/** Shared formatting helpers for the stat cards. */

/** 1 → "1st", 22 → "22nd". Used for positional draft/finish ranks. */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** A W-L record, with the ties only shown when there are any. */
export function recordLabel(record: { wins: number; losses: number; ties: number }): string {
  return `${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ""}`;
}

/** Always-signed number, so a positive value reads as a gain: "+1.5". */
export function signed(value: number, digits = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}
