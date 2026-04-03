import { OAUTH_CLIENT_SECRET, OAUTH_TOKEN_URL } from '$env/static/private';
import { PUBLIC_OAUTH_CLIENT_ID, PUBLIC_OAUTH_REDIRECT_URI } from '$env/static/public';
import { linkOgs } from '$lib/server/db.js';
import { redirect } from '@sveltejs/kit';

export async function GET({ url, cookies, locals }) {
  if (!locals.user) {
    redirect(302, '/login');
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return new Response(JSON.stringify({ error: 'No code parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: PUBLIC_OAUTH_REDIRECT_URI,
    client_id: PUBLIC_OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET
  });

  const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    return new Response(JSON.stringify({ error: 'Token exchange failed', details: tokenData }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const accessToken = tokenData.access_token;
  const meResponse = await fetch('https://online-go.com/api/v1/me/', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const meData = await meResponse.json();

  await linkOgs(locals.user.username, {
    id: meData.id,
    ranking: meData.ranking,
    ogsUsername: meData.username
  });

  cookies.set('ogs_token', accessToken, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30
  });

  redirect(302, '/account/preferences/ogs');
}
