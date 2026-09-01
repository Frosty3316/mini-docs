export function findMatches(root, query) {
  if (!root || !query) return [];

  const needle = query.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const matches = [];

  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? "";
    const lower = text.toLowerCase();
    let from = 0;
    let idx = lower.indexOf(needle, from);
    while (idx !== -1) {
      matches.push({ node, start: idx, end: idx + needle.length });
      from = idx + Math.max(needle.length, 1);
      idx = lower.indexOf(needle, from);
    }
    node = walker.nextNode();
  }

  return matches;
}

function toRange(match) {
  const range = document.createRange();
  range.setStart(match.node, match.start);
  range.setEnd(match.node, match.end);
  return range;
}

export function applyHighlights(matches, activeIndex) {
  if (typeof CSS === "undefined" || !CSS.highlights) return false;

  CSS.highlights.delete("search");
  CSS.highlights.delete("search-current");

  if (!matches.length) return true;

  const ranges = matches.map(toRange);
  CSS.highlights.set("search", new Highlight(...ranges));

  if (activeIndex >= 0 && ranges[activeIndex]) {
    CSS.highlights.set("search-current", new Highlight(ranges[activeIndex]));
  }

  return true;
}

export function clearHighlights() {
  if (typeof CSS !== "undefined" && CSS.highlights) {
    CSS.highlights.delete("search");
    CSS.highlights.delete("search-current");
  }
}

export function scrollMatchIntoView(match, container) {
  if (!match || !container) return;

  const range = toRange(match);
  const rect = range.getBoundingClientRect();
  const box = container.getBoundingClientRect();

  if (rect.top < box.top) {
    container.scrollTop -= box.top - rect.top + 24;
  } else if (rect.bottom > box.bottom) {
    container.scrollTop += rect.bottom - box.bottom + 24;
  }
}
