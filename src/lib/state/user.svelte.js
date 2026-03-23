import { browser } from '$app/environment';

let username = $state(browser ? (localStorage.getItem('username') ?? '') : '');

export function getUsername() {
  return username;
}

export function setUsername(name) {
  username = name.trim();
  if (browser) localStorage.setItem('username', username);
}

export function clearUsername() {
  username = '';
  if (browser) localStorage.removeItem('username');
}
