<script>
	let remember = $state(false);
</script>

<main class="auth auth-login box box-pad">
	<h1 class="box__top">Sign in</h1>

	<form class="form3" method="post" action="/login">
		<div class="form-group">
			<label class="form-label" for="form3-username">Username or email</label>
			<input
				id="form3-username"
				name="username"
				type="text"
				class="form-control"
				required
				autofocus
				autocomplete="username"
			/>
		</div>

		<div class="form-group">
			<label class="form-label" for="form3-password">Password</label>
			<div class="password-wrapper">
				<input
					id="form3-password"
					name="password"
					type="password"
					class="form-control"
					required
					autocomplete="current-password"
				/>
			</div>
		</div>

		<button type="submit" class="submit button button-metal text">Sign in</button>

		<label class="login-remember">
			<input
				name="remember"
				type="checkbox"
				value="true"
				bind:checked={remember}
			/>
			Keep me logged in
		</label>
	</form>

	<div class="alternative">
		<a href="/signup">Register</a>
		<a href="/password-reset">Password reset</a>
		<a href="/login-by-email">Log in by email</a>
	</div>
</main>
