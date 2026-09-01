const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function docIdFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/^\/d\/([^/]+)\/?$/);
  if (!match) return null;
  return UUID_RE.test(match[1]) ? match[1] : null;
}

export function setDocPath(id) {
  const next = id ? `/d/${id}` : "/";
  if (window.location.pathname === next) return;
  window.history.pushState({ docId: id }, "", next);
}

export function shareUrl(id) {
  return `${window.location.origin}/d/${id}`;
}
