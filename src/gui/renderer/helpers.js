// ==========================================================================
// Utilities & Helper Functions
// ==========================================================================

// -------------------------------------------------------------
// Constants & Configuration
// -------------------------------------------------------------
export const ROW_HEIGHT = 44;
export const BUFFER_PX = 100;
export const BUFFER_ROWS = Math.ceil(BUFFER_PX / ROW_HEIGHT);
export const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4'
];

// Escape a value for safe interpolation into an HTML template string.
// Written with escape sequences so the source survives naive HTML-entity
// decoding in file-transfer pipelines; JS evaluates them to the entities.
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '\u0026amp;')
    .replace(/</g, '\u0026lt;')
    .replace(/>/g, '\u0026gt;')
    .replace(/"/g, '\u0026quot;')
    .replace(/'/g, '\u0026#39;');
}

// Renders an inline SVG icon from the sprite defined in index.html.
// `name` is the sprite id without the `i-` prefix (e.g. 'trash' -> #i-trash).
export function svgIcon(name, extraClass = '') {
  const cls = extraClass ? `icon ${extraClass}` : 'icon';
  return `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
}

export function debounce(func, wait = 150) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function formatSize(kb) {
  if (!kb || kb <= 0) return '-';
  const mb = kb / 1024;
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export function getSizeColor(kb) {
  if (!kb || kb <= 0) return '';
  const mb = kb / 1024;
  if (mb < 50) return 'size-small';
  if (mb < 200) return 'size-medium';
  if (mb < 500) return 'size-large';
  return 'size-huge';
}

export function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getAppTypeBadge(app) {
  const kind = (app.uninstallerKind || '').toLowerCase();
  if (kind.includes('store')) {
    return `<span class="badge-tag store">Store</span>`;
  }
  if (kind.includes('msi')) {
    return `<span class="badge-tag msi">MSI</span>`;
  }
  return `<span class="badge-tag win32">Win32</span>`;
}

export function timeAgo(date) {
  if (!date) return 'never';
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
