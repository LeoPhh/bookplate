// A small RFC 4180 CSV reader: quoted fields, doubled quotes ("") inside
// them, commas and line breaks inside quotes (Goodreads reviews have both),
// CRLF or LF line endings, and a leading byte-order mark.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines.
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

// Turns rows into objects keyed by the header row, so columns are found by
// name, not position — exports that add or reorder columns still work.
export function csvRecords(text: string): { headers: string[]; records: Record<string, string>[] } {
  const [headerRow, ...rows] = parseCsv(text);
  const headers = (headerRow ?? []).map((h) => h.trim());
  const records = rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { headers, records };
}
