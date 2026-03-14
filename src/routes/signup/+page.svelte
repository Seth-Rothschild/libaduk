<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { setUsername } from '$lib/user.svelte.js';
	import { startRegistration } from '@simplewebauthn/browser';

	let usernameInput = $state('');
	let error = $state('');
	let submitting = $state(false);

	async function submit(e) {
		e.preventDefault();
		error = '';
		submitting = true;
		try {
			const optionsRes = await fetch('/api/auth/webauthn/register-options', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: usernameInput })
			});
			const optionsData = await optionsRes.json();
			if (!optionsRes.ok) {
				error = optionsData.error ?? 'Something went wrong';
				return;
			}

			let attResp;
			try {
				attResp = await startRegistration({ optionsJSON: optionsData });
			} catch (err) {
				if (err.name === 'InvalidStateError') {
					error = 'A passkey is already registered on this device.';
				} else if (err.name === 'NotAllowedError') {
					error = 'Passkey creation was cancelled.';
				} else {
					error = err.message ?? 'Passkey creation failed.';
				}
				return;
			}

			const verifyRes = await fetch('/api/auth/webauthn/register-verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(attResp)
			});
			const verifyData = await verifyRes.json();
			if (verifyRes.ok) {
				setUsername(verifyData.username);
				await invalidateAll();
				goto('/');
			} else {
				error = verifyData.error ?? 'Something went wrong';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<main class="auth auth-signup box box-pad">
	<h1 class="box__top">Sign up</h1>

	<form id="signup-form" class="form3" onsubmit={submit}>
		<div class="form-group">
			<label class="form-label" for="form3-username">Username</label>
			<input
				id="form3-username"
				name="username"
				type="text"
				class="form-control"
				required
				autofocus
				autocomplete="username"
				bind:value={usernameInput}
			/>
			<small class="form-help">
				2–20 characters: letters, numbers, underscores. Choose carefully — you won't be able to
				change it.
			</small>
		</div>

		{#if error}
			<div class="form-group">
				<p class="error">{error}</p>
			</div>
		{/if}

		<button type="submit" class="submit button button-metal text big" disabled={submitting}>
			{submitting ? 'Creating account…' : 'Sign up with passkey'}
		</button>
	</form>

	<div class="alternative">
		Already have an account? <a href="/login">Sign in</a>
	</div>
</main>
