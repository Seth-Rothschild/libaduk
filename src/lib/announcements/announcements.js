const modules = import.meta.glob('./content/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});

function parseAnnouncement(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const [, frontmatterText, body] = match;
  const frontmatter = {};
  for (const line of frontmatterText.split('\n')) {
    if (!line.trim()) continue;
    const [key, ...rest] = line.split(':');
    frontmatter[key.trim()] = rest.join(':').trim();
  }
  return {
    id: frontmatter.id,
    title: frontmatter.title,
    subtitle: frontmatter.subtitle,
    date: frontmatter.date,
    body: body.trim()
  };
}

export function isExpired(dateString, days) {
  const ageMs = Date.now() - new Date(dateString).getTime();
  const expiryMs = days * 24 * 60 * 60 * 1000;
  return ageMs > expiryMs;
}

function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function renderInline(text) {
  const escaped = escapeHtml(text);
  const withLinks = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  const withBold = withLinks.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function renderBlock(block) {
  const headerMatch = block.match(/^(#{1,3}) (.*)$/);
  if (headerMatch) {
    const level = headerMatch[1].length + 2;
    return `<h${level}>${renderInline(headerMatch[2])}</h${level}>`;
  }
  const lines = block.split('\n');
  const isList = lines.every((line) => line.startsWith('- '));
  if (isList) {
    const items = lines.map((line) => `<li>${renderInline(line.slice(2))}</li>`).join('');
    return `<ul>${items}</ul>`;
  }
  return `<p>${renderInline(block.replaceAll('\n', ' '))}</p>`;
}

export function renderMarkdown(markdown) {
  const blocks = markdown.split('\n\n').filter((block) => block.trim());
  return blocks.map(renderBlock).join('');
}

export const allAnnouncements = Object.values(modules)
  .map(parseAnnouncement)
  .filter(Boolean)
  .sort((a, b) => new Date(b.date) - new Date(a.date));
