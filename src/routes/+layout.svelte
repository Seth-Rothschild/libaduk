<script>
	import '../app.scss';
	import { getUsername, clearUsername } from '$lib/user.svelte.js';
	import { pingState } from '$lib/ping.svelte.js';
	import { themeState } from '$lib/theme.svelte.js';
	import { onMount } from 'svelte';

	onMount(() => {
		themeState.init();
		pingState.start();
		return () => pingState.stop();
	});

	let { children } = $props();

	const username = $derived(getUsername());
	const signedIn = $derived(username.length > 0);

	let searchExpanded = $state(false);
	let settingsOpen = $state(false);
	let searchInput = $state(null);
	let dasherPane = $state('main');

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
		if (!settingsOpen) dasherPane = 'main';
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
			<span class="site-icon" data-icon="&#xe029;"></span>
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
			<a data-icon="&#xe057;" aria-label="Search" class="link"></a>
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

		{#snippet pingStatus()}
			<a class="status" href="/lag">
				<signal class="q{pingState.lagRating}">
					{#each [1, 2, 3, 4] as bar}
						<i class:off={bar > pingState.lagRating}></i>
					{/each}
				</signal>
				<span class="ping"><em>PING</em><strong>{pingState.ping ?? '?'}</strong><em>ms</em></span>
			</a>
		{/snippet}

		{#snippet backgroundPane()}
			<button class="sub-head text" data-icon="&#xe047;" onclick={() => (dasherPane = 'main')}>
				Background
			</button>
			<div class="selector">
				{#each [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']] as [value, label]}
					<button
						class="text"
						class:active={themeState.setting === value}
						data-icon="&#xe023;"
						onclick={() => themeState.set(value)}
					>{label}</button>
				{/each}
			</div>
		{/snippet}

		{#if signedIn}
			<a id="user_tag" href="/profile" class="link">{username}</a>
			<div class="dasher" class:shown={settingsOpen}>
				<button class="toggle link" data-icon="&#xe005;" aria-label="Settings" onclick={toggleSettings}></button>
				<div class="dropdown">
					{#if dasherPane === 'background'}
						{@render backgroundPane()}
					{:else}
						<a href="/settings">Settings</a>
						<a href="/settings/board">Board</a>
						<button onclick={() => (dasherPane = 'background')}>Background</button>
						<button onclick={() => { clearUsername(); settingsOpen = false; dasherPane = 'main'; }}>Sign out</button>
					{/if}
					{@render pingStatus()}
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
					data-icon="&#xe005;"
					aria-label="Settings"
					title="Settings"
					onclick={toggleSettings}
				></button>
				<div class="dropdown">
					{#if dasherPane === 'background'}
						{@render backgroundPane()}
					{:else}
						<a href="/settings/board">Board</a>
						<button onclick={() => (dasherPane = 'background')}>Background</button>
					{/if}
					{@render pingStatus()}
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
