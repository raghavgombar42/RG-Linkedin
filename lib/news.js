// Google News RSS search: free, no key, no account.

const decode = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]);

export async function fetchTopNews(query) {
  const url =
    'https://news.google.com/rss/search?' +
    new URLSearchParams({ q: `${query} when:30d`, hl: 'en-IN', gl: 'IN', ceid: 'IN:en' });
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (content-engine)' } });
  if (!res.ok) return null;
  const xml = await res.text();
  const item = xml.match(/<item>([\s\S]*?)<\/item>/)?.[1];
  if (!item) return null;

  const source = tag(item, 'source');
  let headline = tag(item, 'title');
  // Google appends " - Publication" to titles; strip it since we show source separately.
  if (source && headline.endsWith(` - ${source}`)) headline = headline.slice(0, -(source.length + 3));
  const pubDate = tag(item, 'pubDate');

  return {
    headline,
    source: source || 'Unknown source',
    date: pubDate ? new Date(pubDate).toDateString() : 'Unknown date',
    link: tag(item, 'link'),
    summary: tag(item, 'description').slice(0, 300),
  };
}
