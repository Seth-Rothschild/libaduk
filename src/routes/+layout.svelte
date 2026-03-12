<script>
	import '../app.scss';

	let { children } = $props();

	// Stub auth state — toggle to preview signed-in UI
	let signedIn = $state(false);
	let username = 'player1';

	let searchExpanded = $state(false);
	let settingsOpen = $state(false);
	let searchInput = $state(null);

	$effect(() => {
		document.body.classList.toggle('clinput', searchExpanded);
	});

	function onSearchMouseEnter() {
		searchExpanded = true;
		searchInput?.focus();
	}

	function onSearchMouseLeave() {
		searchExpanded = false;
		searchInput?.blur();
	}

	function onSearchBlur() {
		searchExpanded = false;
	}

	function toggleSettings() {
		settingsOpen = !settingsOpen;
	}
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
		<div
			id="clinput"
			onmouseenter={onSearchMouseEnter}
			onmouseleave={onSearchMouseLeave}
		>
			<a data-icon="" aria-label="Search" class="link"></a>
			<input
				type="text"
				spellcheck="false"
				autocomplete="off"
				aria-label="Search"
				placeholder="Search"
				enterkeyhint="search"
				bind:this={searchInput}
				onblur={onSearchBlur}
			/>
		</div>

		{#if signedIn}
			<a id="user_tag" href="/profile" class="link">{username}</a>
			<div class="dasher" class:shown={settingsOpen}>
				<button class="toggle link" data-icon="" aria-label="Settings" onclick={toggleSettings}></button>
				<div class="dropdown">
					<a href="/settings">Settings</a>
					<a href="/settings/theme">Theme</a>
					<a href="/settings/board">Board</a>
					<button onclick={() => { signedIn = false; settingsOpen = false; }}>Sign out</button>
				</div>
			</div>
		{:else}
			<div class="signin-or-signup">
				<a href="/signup" class="button button-metal signup">Register</a>
				<a href="/login" class="button button-metal">Sign in</a>
			</div>
			<div class="dasher" class:shown={settingsOpen}>
				<button
					class="toggle anon link"
					data-icon=""
					aria-label="Settings"
					title="Settings"
					onclick={toggleSettings}
				></button>
				<div class="dropdown">
					<a href="/settings/theme">Theme</a>
					<a href="/settings/board">Board</a>
				</div>
			</div>
		{/if}
	</div>
</header>

<div id="main-wrap">
	<main>
		{@render children()}
	</main>
</div>
