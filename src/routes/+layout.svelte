<script>
	import '../app.scss';
	import { setUsername, clearUsername } from '$lib/user.svelte.js';
	import { pingState } from '$lib/ping.svelte.js';
	import { themeState } from '$lib/theme.svelte.js';
	import { boardState } from '$lib/boardState.svelte.js';
	import GameSetupModal from '$lib/GameSetupModal.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';

	onMount(() => {
		themeState.init();
		boardState.init();
		pingState.start();
		return () => pingState.stop();
	});

	let { children, data } = $props();

	// Server is authoritative; keep localStorage in sync for client-side reads
	$effect(() => {
		if (data.user) setUsername(data.user.username);
		else clearUsername();
	});

	const username = $derived(data.user?.username ?? '');
	const signedIn = $derived(username.length > 0);

	async function signOut() {
		await fetch('/api/auth/logout', { method: 'POST' });
		clearUsername();
		await invalidateAll();
		goto('/');
	}

	let searchExpanded = $state(false);
	let settingsOpen = $state(false);
	let searchInput = $state(null);
	let dasherPane = $state('main');
	let setupModal = $state(null);

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
					<button onclick={() => (setupModal = 'hook')}>Create a game</button>
					<button onclick={() => (setupModal = 'friend')}>Challenge a friend</button>
				</div>
			</section>
			<section>
				<a href="/">Community</a>
				<div role="group">
					<a href="/">Players</a>
					<a href="/">Teams</a>
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

		{#snippet boardPane()}
			<button class="sub-head text" data-icon="&#xe047;" onclick={() => (dasherPane = 'main')}>
				Board
			</button>
			<div class="board-settings">
				<label class="board-setting-toggle">
					<input
						type="checkbox"
						checked={boardState.showCoords}
						onchange={() => boardState.toggleCoords()}
					/>
					Coordinates
				</label>
			</div>
		{/snippet}

		{#if signedIn}
			<a id="user_tag" href="/" class="link">{username}</a>
			<div class="dasher" class:shown={settingsOpen}>
				<button class="toggle link" data-icon="&#xe005;" aria-label="Settings" onclick={toggleSettings}></button>
				<div class="dropdown">
					{#if dasherPane === 'background'}
						{@render backgroundPane()}
					{:else if dasherPane === 'board'}
						{@render boardPane()}
					{:else}
						<a href="/">Settings</a>
						<button onclick={() => (dasherPane = 'board')}>Board</button>
						<button onclick={() => (dasherPane = 'background')}>Background</button>
						<button onclick={() => { signOut(); settingsOpen = false; dasherPane = 'main'; }}>Sign out</button>
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
					{:else if dasherPane === 'board'}
						{@render boardPane()}
					{:else}
						<button onclick={() => (dasherPane = 'board')}>Board</button>
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

{#if setupModal}
	<GameSetupModal gameType={setupModal} onClose={() => (setupModal = null)} />
{/if}
