import { browser } from '$app/environment';

function resolveEffective(setting) {
  if (setting !== 'system') return setting;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(setting) {
  const effective = resolveEffective(setting);
  document.documentElement.classList.toggle('light', effective === 'light');
}

class ThemeState {
  setting = $state('system');

  init() {
    if (!browser) return;
    const stored = localStorage.getItem('libaduk-theme') ?? 'system';
    this.setting = stored;
    applyTheme(stored);

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (this.setting === 'system') applyTheme('system');
    });
  }

  set(value) {
    this.setting = value;
    localStorage.setItem('libaduk-theme', value);
    applyTheme(value);
  }
}

export const themeState = new ThemeState();
