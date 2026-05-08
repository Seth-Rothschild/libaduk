import en from './en.json';
import ko from './ko.json';
import ja from './ja.json';
import zh from './zh.json';

const locales = { en, ko, ja, zh };

function detectLocale() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('locale');
    if (saved && saved in locales) return saved;
  }
  if (typeof navigator !== 'undefined') {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const prefix = tag.split('-')[0];
      if (prefix in locales) return prefix;
    }
  }
  return 'en';
}

let current = $state(detectLocale());

export function t(key) {
  return locales[current]?.[key] ?? key;
}

export const locale = {
  get current() {
    return current;
  },
  set(lang) {
    current = lang;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('locale', lang);
    }
  }
};
