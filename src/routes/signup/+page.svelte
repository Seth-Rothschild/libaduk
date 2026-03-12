<main class="auth auth-signup box box-pad">
	<h1 class="box__top">Sign up</h1>

	<form id="signup-form" class="form3" method="post" action="/signup">
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
			/>
			<small class="form-help">
				Choose your username carefully — you will not be able to change it.
			</small>
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
					autocomplete="new-password"
				/>
			</div>
		</div>

		<div class="form-group">
			<label class="form-label" for="form3-email">Email</label>
			<input
				id="form3-email"
				name="email"
				type="email"
				class="form-control"
				required
			/>
			<small class="form-help">
				Used to reset your password. We will not spam you.
			</small>
		</div>

		<div class="form-group text" data-icon="">
			<p>This is a Go game platform. Be excellent to each other.</p>
			<br />
			<small>
				By registering you agree to our
				<a href="/terms-of-service">Terms of Service</a>
				and
				<a href="/privacy">Privacy Policy</a>.
			</small>
		</div>

		<div class="agreement">
			<div class="form-check form-group">
				<div class="form-check__container">
					<span class="form-check__input">
						<input
							id="form3-agreement_nice"
							name="agreement.nice"
							type="checkbox"
							value="true"
							required
						/>
						<label class="form-label" for="form3-agreement_nice"></label>
					</span>
					<label class="form-label" for="form3-agreement_nice">I will play fairly</label>
				</div>
			</div>

			<div class="form-check form-group">
				<div class="form-check__container">
					<span class="form-check__input">
						<input
							id="form3-agreement_account"
							name="agreement.account"
							type="checkbox"
							value="true"
							required
						/>
						<label class="form-label" for="form3-agreement_account"></label>
					</span>
					<label class="form-label" for="form3-agreement_account">
						I understand the <a href="/terms-of-service">terms of service</a> and will
						not create multiple accounts
					</label>
				</div>
			</div>
		</div>

		<button type="submit" class="submit button button-metal text big">Sign up</button>
	</form>
</main>
