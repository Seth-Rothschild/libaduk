let me = $state(null);

export function getMe() {
  return me;
}

export async function fetchMe() {
  const res = await fetch('/api/user/me');
  if (res.ok) {
    me = await res.json();
  } else {
    me = null;
  }
}

export async function updateMe(patch) {
  const res = await fetch('/api/user/me', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (res.ok) {
    me = await res.json();
  }
}
