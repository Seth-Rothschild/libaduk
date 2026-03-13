<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { setUsername } from '$lib/user.svelte.js';

	let usernameInput = $state('');
	let error = $state('');
	let submitting = $state(false);

	async function submit(e) {
		e.preventDefault();
		error = '';
		submitting = true;
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: usernameInput })
			});
			const data = await res.json();
			if (res.ok) {
				setUsername(data.username);
				await invalidateAll();
				goto('/');
			} else {
				error = data.error ?? 'Something went wrong';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<main class="auth auth-login box box-pad">
	<h1 class="box__top">Sign in</h1>

	<form class="form3" onsubmit={submit}>
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
		</div>

		{#if error}
			<div class="form-group">
				<p class="error">{error}</p>
			</div>
		{/if}

		<button type="submit" class="submit button button-metal text" disabled={submitting}>
			{submitting ? 'Signing in…' : 'Sign in'}
		</button>
	</form>

	<div class="alternative">
		<a href="/signup">Register</a>
	</div>
</main>
