// ==========================================================================
// Shared UI Components: Toasts, Confirm Modal, Activity Log
// ==========================================================================

import {
  toastContainer,
  confirmModal,
  confirmModalIcon,
  confirmModalTitleText,
  confirmModalMessage,
  confirmModalDetail,
  confirmModalOkBtn,
  confirmModalCancelBtn,
  confirmModalCloseX,
  uninstallModal,
  activityLogList
} from './dom.js';
import { escapeHtml, svgIcon } from './helpers.js';
import { S } from './state.js';

// -------------------------------------------------------------
// Toast Notification System
// -------------------------------------------------------------
export function showToast(message, type = 'info', duration = 5000) {
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check';
  else if (type === 'error') iconName = 'close';
  else if (type === 'warning') iconName = 'warning';

  toast.innerHTML = `
    <span class="toast-icon">${svgIcon(iconName)}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
    <button class="toast-close" type="button" aria-label="Dismiss">${svgIcon('close')}</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  const removeToast = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 150);
  };

  closeBtn.addEventListener('click', removeToast);
  if (duration > 0) {
    setTimeout(removeToast, duration);
  }

  toastContainer.appendChild(toast);
}

// -------------------------------------------------------------
// Confirmation Modal (styled replacement for native window.confirm)
// -------------------------------------------------------------
const CONFIRM_TONE_ICONS = {
  danger: 'warning',
  warning: 'warning',
  info: 'info',
  success: 'check-circle'
};

let confirmModalResolver = null;

// `message` and `detail` are injected as HTML so callers can emphasise values
// with <strong>; any user-supplied text must be escaped by the caller.
export function showConfirm(options = {}) {
  const {
    title = 'Confirm Action',
    message = 'Are you sure you want to continue?',
    detail = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'danger',
    icon = CONFIRM_TONE_ICONS[tone] || 'warning'
  } = options;

  // Fallback keeps behaviour intact if the modal markup is ever removed.
  if (!confirmModal) {
    return Promise.resolve(window.confirm(String(message).replace(/<[^>]*>/g, '')));
  }

  // A second request while one is pending cancels the previous one.
  if (confirmModalResolver) {
    closeConfirmModal(false);
  }

  confirmModalIcon.className = `modal-title-icon tone-${tone}`;
  confirmModalIcon.innerHTML = svgIcon(icon);
  confirmModalTitleText.textContent = title;
  confirmModalMessage.innerHTML = message;

  if (detail) {
    confirmModalDetail.innerHTML = detail;
    confirmModalDetail.style.display = 'block';
  } else {
    confirmModalDetail.innerHTML = '';
    confirmModalDetail.style.display = 'none';
  }

  confirmModalOkBtn.textContent = confirmLabel;
  confirmModalOkBtn.className = tone === 'info' ? 'btn btn-primary' : 'btn btn-danger';
  confirmModalCancelBtn.textContent = cancelLabel;

  confirmModal.classList.add('open');
  setTimeout(() => confirmModalOkBtn.focus(), 30);

  return new Promise((resolve) => {
    confirmModalResolver = resolve;
  });
}

export function closeConfirmModal(result) {
  if (!confirmModal || !confirmModal.classList.contains('open')) return;

  confirmModal.classList.remove('open');
  const resolve = confirmModalResolver;
  confirmModalResolver = null;
  if (resolve) resolve(result);
}

if (confirmModal) {
  confirmModalOkBtn.addEventListener('click', () => closeConfirmModal(true));
  confirmModalCancelBtn.addEventListener('click', () => closeConfirmModal(false));
  confirmModalCloseX.addEventListener('click', () => closeConfirmModal(false));

  // Backdrop click dismisses (treated as cancel)
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) closeConfirmModal(false);
  });
}

// -------------------------------------------------------------
// Modal Focus Trap (Tab cycles inside the open modal)
// -------------------------------------------------------------
// Escape closes are handled globally in main.js; here we make sure keyboard
// users cannot Tab out of a confirmation dialog into the background UI.
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

function trapModalTab(modal, event) {
  const focusables = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const current = document.activeElement;

  if (!modal.contains(current)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && current === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && current === last) {
    event.preventDefault();
    first.focus();
  }
}

if (confirmModal) {
  confirmModal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') trapModalTab(confirmModal, e);
  });
}

if (uninstallModal) {
  uninstallModal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') trapModalTab(uninstallModal, e);
  });
}

// -------------------------------------------------------------
// Activity Log Tracker
// -------------------------------------------------------------
export function recordRpcActivity(method, latencyMs, ok) {
  S.recentRpcActivity.unshift({
    method,
    latency: latencyMs,
    ok,
    timestamp: new Date()
  });

  if (S.recentRpcActivity.length > 5) {
    S.recentRpcActivity.pop();
  }

  renderActivityLog();
}

export function renderActivityLog() {
  if (!activityLogList) return;

  if (S.recentRpcActivity.length === 0) {
    activityLogList.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); padding: 8px 0;">No RPC calls recorded yet.</div>`;
    return;
  }

  activityLogList.innerHTML = S.recentRpcActivity.map((item) => `
    <div class="activity-item">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="activity-dot ${item.ok ? 'ok' : 'fail'}"></span>
        <span class="activity-method">${escapeHtml(item.method)}</span>
      </div>
      <div class="activity-meta">
        <span>${item.latency}ms</span>
        <span>${item.timestamp.toLocaleTimeString()}</span>
      </div>
    </div>
  `).join('');
}
