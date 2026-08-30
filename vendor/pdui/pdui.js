/** PhongDang UI Design System runtime helpers. */
(function (window, document) {
  'use strict';

  const STORAGE_KEY = 'pd_theme';
  const root = document.documentElement;

  const Theme = {
    get() { return root.classList.contains('dark') ? 'dark' : 'light'; },
    set(theme) {
      const next = theme === 'dark' ? 'dark' : 'light';
      root.classList.toggle('dark', next === 'dark');
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      document.querySelectorAll('[data-pd-theme-icon]').forEach(el => { el.textContent = next === 'dark' ? '☀️' : '🌙'; });
      document.querySelectorAll('[data-pd-theme-label]').forEach(el => { el.textContent = next === 'dark' ? 'Sáng' : 'Tối'; });
      document.dispatchEvent(new CustomEvent('pdui:themechange', { detail: { theme: next } }));
    },
    toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
    init() {
      let saved = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
      this.set(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
      document.querySelectorAll('[data-pd-theme-toggle]').forEach(button => button.addEventListener('click', () => this.toggle()));
    }
  };

  const Toast = {
    timer: null,
    show(message, type = 'success', duration = 2500) {
      let toast = document.getElementById('pd-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'pd-toast';
        toast.className = 'pd-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        const icon = document.createElement('span');
        icon.dataset.pdToastIcon = '';
        const messageEl = document.createElement('span');
        messageEl.dataset.pdToastMessage = '';
        toast.append(icon, messageEl);
        document.body.appendChild(toast);
      }
      const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
      toast.querySelector('[data-pd-toast-icon]').textContent = icons[type] || 'ℹ️';
      toast.querySelector('[data-pd-toast-message]').textContent = String(message);
      toast.hidden = false;
      toast.classList.add('pd-toast--visible');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { toast.hidden = true; toast.classList.remove('pd-toast--visible'); }, Math.max(500, Number(duration) || 2500));
    }
  };

  const Modal = {
    previousFocus: null,
    open(id) {
      const el = document.getElementById(id);
      if (!el) return;
      this.previousFocus = document.activeElement;
      el.hidden = false;
      el.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    },
    close(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.hidden = true;
      el.classList.add('hidden');
      document.body.style.overflow = '';
      this.previousFocus?.focus?.();
    },
    init() {
      document.addEventListener('click', event => {
        const opener = event.target.closest('[data-pd-modal-open]');
        const closer = event.target.closest('[data-pd-modal-close], [data-close-modal]');
        if (opener) this.open(opener.dataset.pdModalOpen);
        if (closer) this.close(closer.dataset.pdModalClose || closer.closest('.pd-modal, .modal-backdrop')?.id);
        if (event.target.matches?.('.pd-modal, .modal-backdrop')) this.close(event.target.id);
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') document.querySelectorAll('.pd-modal:not([hidden])').forEach(el => this.close(el.id));
      });
    }
  };

  const Tabs = {
    select(tab) {
      const group = tab.closest('[data-tab-group]') || document;
      const name = tab.dataset.tab;
      group.querySelectorAll('[data-tab]').forEach(button => {
        const active = button === tab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });
      group.querySelectorAll('[data-tab-content]').forEach(panel => {
        const active = panel.dataset.tabContent === name;
        panel.classList.toggle('hidden', !active);
        panel.hidden = !active;
      });
      group.dispatchEvent(new CustomEvent('pdui:tabchange', { detail: { value: name, element: tab } }));
    },
    init() {
      document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => this.select(tab)));
      document.querySelectorAll('[data-pill-group]').forEach(group => {
        group.querySelectorAll('[data-value]').forEach(pill => pill.addEventListener('click', () => {
          group.querySelectorAll('[data-value]').forEach(item => item.classList.toggle('active', item === pill));
          group.dispatchEvent(new CustomEvent('pdui:pillchange', { detail: { value: pill.dataset.value, element: pill } }));
        }));
      });
    }
  };

  window.PDUI = { Theme, Toast, Modal, Tabs, version: '1.2.0' };
  document.addEventListener('DOMContentLoaded', () => { Theme.init(); Modal.init(); Tabs.init(); });
})(window, document);
