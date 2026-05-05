// Convert a Google Sheet date cell value into ISO YYYY-MM-DD.
// Handles Excel serial numbers (preferred — request the sheet with
// valueRenderOption=UNFORMATTED_VALUE & dateTimeRenderOption=SERIAL_NUMBER),
// plus ISO strings, DD/MM/YYYY, and Buddhist years (subtracts 543 if y > 2400).
export function parseSheetDate(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number') {
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
  const s = String(raw).trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    let [, y, mo, day] = m;
    if (Number(y) > 2400) y = String(Number(y) - 543);
    return `${y}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let [, day, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    if (Number(y) > 2400) y = String(Number(y) - 543);
    return `${y}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
  return '';
}
