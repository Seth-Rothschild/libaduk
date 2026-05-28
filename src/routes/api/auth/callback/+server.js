import { OAUTH_CLIENT_SECRET, OAUTH_TOKEN_URL } from '$env/static/private';
import { PUBLIC_OAUTH_CLIENT_ID, PUBLIC_OAUTH_REDIRECT_URI } from '$env/static/public';
import { getUser, createUser, linkOgs } from '$lib/server/db.js';
import { createSession } from '$lib/server/sessions.js';
import { redirect } from '@sveltejs/kit';

export async function GET({ url, cookies, locals }) {
  const errorPage = locals.user ? '/account/preferences/ogs' : '/login';
  const successPage = locals.user ? '/account/preferences/ogs' : '/tv';

  const state = url.searchParams.get('state');
  const savedState = cookies.get('oauth_state');
  cookies.delete('oauth_state', { path: '/' });
  if (!state || state !== savedState) {
    console.error('OAuth callback: invalid state parameter. This also happens on cancel.');
    redirect(302, `${errorPage}?error=oauth_failed`);
  }

  const code = url.searchParams.get('code');
  if (!code) {
    console.error('OAuth callback: no code parameter');
    redirect(302, `${errorPage}?error=oauth_failed`);
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
    console.error('OAuth callback: token exchange failed', tokenData);
    redirect(302, `${errorPage}?error=oauth_failed`);
  }

  const accessToken = tokenData.access_token;
  const meResponse = await fetch('https://online-go.com/api/v1/me/', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const meData = await meResponse.json();

  const ogsInfo = {
    id: meData.id,
    ranking: meData.ranking,
    ogsUsername: meData.username
  };

  if (locals.user) {
    await linkOgs(locals.user.username, ogsInfo);
  } else {
    const localUsername = `${meData.username} (OGS)`;
    const existing = await getUser(localUsername);
    if (!existing) {
      await createUser(localUsername);
    }
    await linkOgs(localUsername, ogsInfo);
    const token = await createSession(localUsername);
    cookies.set('session', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    });
  }

  cookies.set('ogs_token', accessToken, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30
  });

  redirect(302, successPage);
}
