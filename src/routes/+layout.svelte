<script>
	import '../app.scss';

	let { children } = $props();

	// Stub auth state — toggle to preview signed-in UI
	let signedIn = $state(false);
	let username = 'player1';
</script>

<!-- Mobile hamburger toggle (CSS-only) -->
<input type="checkbox" id="topnav-toggle" class="topnav-toggle" />

<header>
	<label class="hbg" for="topnav-toggle" aria-label="Menu">
		<span class="hbg__in"></span>
	</label>

	<div class="site-title-nav">
		<a class="site-title" href="/">
			<span class="home">libaduk</span>
		</a>
		<nav id="topnav" class="hover">
			<section>
				<a href="/">
					<span class="play">Play</span>
					<span class="home">libaduk</span>
				</a>
				<div role="group">
					<a href="/">Create a game</a>
					<a href="/challenge">Challenge a friend</a>
				</div>
			</section>
			<section>
				<a href="/players">Community</a>
				<div role="group">
					<a href="/players">Players</a>
					<a href="/teams">Teams</a>
				</div>
			</section>
		</nav>
	</div>

	<div class="site-buttons">
		{#if signedIn}
			<a id="user_tag" href="/profile" class="link">{username}</a>
		{:else}
			<div class="signin-or-signup">
				<a href="/signup" class="button button-metal signup">Register</a>
				<button class="button button-metal" onclick={() => (signedIn = true)}>Sign in</button>
			</div>
		{/if}
	</div>
</header>

<div id="main-wrap">
	<main>
		{@render children()}
	</main>
</div>

<!-- Friends panel — fixed bottom-right, shown on large screens -->
<div id="friend_box">
	<div class="friend_box_title">Friends</div>
	<div class="content">
		<div class="nobody">
			<span>No friends online</span>
			<a href="/players" class="find">Find players</a>
		</div>
	</div>
</div>

<!-- Sign-in modal — shown when not signed in -->
{#if !signedIn}
	<dialog open>
		<div class="close-button-anchor">
			<button class="close-button" onclick={() => (signedIn = true)} aria-label="Close">✕</button>
		</div>
		<div class="scrollable">
			<div style="padding: 2em; min-width: 280px;">
				<h2 style="margin-bottom: 1em;">Sign in to libaduk</h2>
				<form onsubmit={(e) => { e.preventDefault(); signedIn = true; }}>
					<div style="display: flex; flex-direction: column; gap: 0.8em;">
						<input
							type="text"
							placeholder="Username"
							style="padding: 0.5em; background: var(--c-bg-input); border: 1px solid var(--c-border); color: var(--c-font); border-radius: 4px;"
						/>
						<input
							type="password"
							placeholder="Password"
							style="padding: 0.5em; background: var(--c-bg-input); border: 1px solid var(--c-border); color: var(--c-font); border-radius: 4px;"
						/>
						<button type="submit" class="button button-metal" style="margin-top: 0.5em;">
							Sign in
						</button>
					</div>
				</form>
				<p style="margin-top: 1em; color: var(--c-font-dim); text-align: center; font-size: 0.9em;">
					No account? <a href="/signup">Register</a>
				</p>
			</div>
		</div>
	</dialog>
{/if}
