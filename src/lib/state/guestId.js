import { browser } from '$app/environment';

function generateGuestId() {
  const digits = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `Guest${digits}`;
}

let cachedId = null;

if (browser) {
  cachedId = localStorage.getItem('guest-id');
  if (!cachedId) {
    cachedId = generateGuestId();
    localStorage.setItem('guest-id', cachedId);
  }
  document.cookie = `guest-id=${cachedId}; path=/; SameSite=Lax`;
}

export function getGuestId() {
  if (!browser) return 'Guest';
  return cachedId;
}
