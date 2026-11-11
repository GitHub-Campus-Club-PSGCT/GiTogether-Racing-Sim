// One time format across the game, like a timing screen:
// completed times to the thousandth (1:38.804), running clocks to the tenth (1:12.4).
export function formatTime(seconds, { live = false } = {}) {
  if (seconds == null || Number.isNaN(seconds)) return "–:––.–––".slice(0, live ? 6 : 8);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  const decimals = live ? 1 : 3;
  const secs = rest.toFixed(decimals).padStart(decimals + 3, "0");
  return `${minutes}:${secs}`;
}

/** Signed gap in seconds, e.g. +0.412 or −1.207 (true minus sign). */
export function formatGap(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "";
  return `${seconds < 0 ? "−" : "+"}${Math.abs(seconds).toFixed(3)}`;
}
