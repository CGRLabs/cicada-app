// ==========================================================================
// Search Core: pure matching & ranking helpers (no DOM dependencies)
// ==========================================================================
// Shared by the command palette. Kept free of DOM imports so the test suite
// can exercise the ranking logic in plain Node.

// Normalize for case/diacritic-insensitive substring comparisons.
export function normalize(text) {
  return String(text == null ? '' : text).toLowerCase().trim();
}

// Score how well `query` matches `text`:
//   0 -> no match; 1 -> substring; 2 -> word-boundary hit; 3 -> prefix hit.
// An empty query matches everything with score 0 (caller decides ordering).
export function scoreMatch(text, query) {
  const t = normalize(text);
  const q = normalize(query);
  if (!q) return 0;
  if (!t) return 0;

  if (t.startsWith(q)) return 3;

  const wordIndex = t.indexOf(q);
  if (wordIndex > 0 && /[\s\-_@.]/.test(t[wordIndex - 1])) return 2;
  if (wordIndex > 0) return 1;
  return 0;
}

// Best score across several text fields of one item.
export function scoreItem(item, fields, query) {
  let best = 0;
  for (const field of fields) {
    const s = scoreMatch(item[field], query);
    if (s > best) best = s;
    if (best === 3) break;
  }
  return best;
}

// Filter + rank a pool of items. Returns at most `limit` items whose best
// field score is > 0, ordered by score desc then by original position (stable).
// An empty query returns the first `limit` items unchanged.
export function filterPool(items, query, fields, limit = 8) {
  if (!Array.isArray(items)) return [];
  if (!normalize(query)) return items.slice(0, limit);

  const scored = [];
  for (let i = 0; i < items.length; i++) {
    const score = scoreItem(items[i], fields, query);
    if (score > 0) scored.push({ item: items[i], score, index: i });
  }

  scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  return scored.slice(0, limit).map((entry) => entry.item);
}
