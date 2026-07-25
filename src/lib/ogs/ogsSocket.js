import { GobanSocket } from '$lib/goban.js';

const OGS_SOCKET_URL = 'wss://wsp.online-go.com/';
const OGS_CONFIG_URL = 'https://online-go.com/api/v1/ui/config/';

export async function fetchOgsConfig(token = null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(OGS_CONFIG_URL, { headers });
  if (!res.ok) return null;
  return await res.json();
}

export function openOgsSocket(jwt) {
  const socket = new GobanSocket(OGS_SOCKET_URL);
  socket.authenticate({ jwt });
  return socket;
}
