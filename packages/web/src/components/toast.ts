declare const bootstrap: any;

const CONTAINER_ID = 'toast-container';

function getOrCreateContainer(): HTMLElement {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1080';
    document.body.appendChild(container);
  }
  return container;
}

const BG_CLASS: Record<string, string> = {
  success: 'text-bg-success',
  danger: 'text-bg-danger',
  warning: 'text-bg-warning',
};

export function showToast(message: string, type: 'success' | 'danger' | 'warning'): void {
  const container = getOrCreateContainer();

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center ${BG_CLASS[type]} border-0`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');

  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="关闭"></button>
    </div>`;

  container.appendChild(toastEl);

  const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  toast.show();
}
