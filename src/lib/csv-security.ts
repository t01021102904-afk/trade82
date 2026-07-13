export function neutralizeCsvFormula(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function csvCell(value: unknown) {
  return `"${neutralizeCsvFormula(value).replaceAll('"', '""')}"`;
}
