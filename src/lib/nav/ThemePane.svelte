<script>
  import { stoneTheme } from './stoneTheme.svelte.js';
  import { extractAsar } from './asar.js';

  function extractBoardColor(cssText) {
    const varMatch = cssText.match(/--shudan-board-background-color\s*:\s*([^;}\n]+)/);
    if (varMatch) return varMatch[1].trim();
    const blockMatch = cssText.match(/\.shudan-goban-image\s*\{([^}]+)\}/);
    if (blockMatch) {
      const bgMatch = blockMatch[1].match(/background(?:-color)?\s*:\s*([^;}\n]+)/);
      if (bgMatch) {
        const val = bgMatch[1].trim();
        if (val !== 'none' && !val.startsWith('url')) return val;
      }
    }
    return null;
  }

  async function boardColorFromEntries(entries) {
    const cssEntry = Object.entries(entries).find(([p]) => p.endsWith('styles.css'));
    if (!cssEntry) return null;
    try {
      return extractBoardColor(await cssEntry[1].text());
    } catch {
      return null;
    }
  }

  function classifyBlobs(entries) {
    const lower = (path) => path.toLowerCase();
    const isImage = (path) => /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
    const images = Object.entries(entries).filter(([path]) => isImage(path));
    const blackStones = images.filter(([p]) => lower(p).includes('black')).map(([, b]) => b);
    const whiteStones = images.filter(([p]) => lower(p).includes('white')).map(([, b]) => b);
    const boardEntry = images.find(([p]) => lower(p).includes('board'));
    const board = boardEntry ? boardEntry[1] : null;
    return { blackStones, whiteStones, board };
  }

  async function nameFromPackageJson(entries) {
    const pkg =
      entries['package.json'] ??
      Object.values(entries).find((_, i) => Object.keys(entries)[i].endsWith('package.json'));
    if (!pkg) return null;
    try {
      const text = await pkg.text();
      return JSON.parse(text).name ?? null;
    } catch {
      return null;
    }
  }

  async function handleAsarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const entries = extractAsar(buffer);
    const name = (await nameFromPackageJson(entries)) ?? file.name.replace(/\.asar$/, '');
    const boardColor = await boardColorFromEntries(entries);
    await stoneTheme.addTheme(name, { ...classifyBlobs(entries), boardColor });
    e.target.value = '';
  }
</script>

<div class="stone-picker">
  <button
    class="stone-btn"
    class:active={stoneTheme.activeId === null}
    title="Default"
    onclick={() => stoneTheme.setActive(null)}
    style="background: url('/images/go/board.png') center/cover no-repeat"
  >
    <stone style="background-image: url('/images/go/stone_1.svg')"></stone>
    <stone style="background-image: url('/images/go/stone_-1.svg')"></stone>
  </button>

  {#each stoneTheme.themes as theme}
    {@const urls = stoneTheme.urlsFor(theme.id)}
    <div class="stone-wrap">
      <button
        class="stone-btn"
        class:active={stoneTheme.activeId === theme.id}
        title={theme.name}
        onclick={() => stoneTheme.setActive(theme.id)}
        style={urls.boardThumb
          ? `background: url('${urls.boardThumb}') center/cover no-repeat`
          : theme.boardColor
            ? `background-color: ${theme.boardColor}`
            : ''}
      >
        <stone style="background-image: url('{urls.black[0] ?? ''}')"></stone>
        <stone style="background-image: url('{urls.white[0] ?? ''}')"></stone>
      </button>
      <button
        class="stone-delete"
        aria-label="Delete {theme.name}"
        onclick={() => stoneTheme.removeTheme(theme.id)}>×</button
      >
    </div>
  {/each}
</div>
<label class="button stone-upload">
  Import Theme
  <input type="file" accept=".asar" onchange={handleAsarUpload} />
</label>
