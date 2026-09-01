import { mkdir, readFile, writeFile } from 'node:fs/promises';

const migrationUrl = new URL(
  '../supabase/migrations/202609010005_publish_ten_judgment_articles.sql',
  import.meta.url,
);
const outputUrl = new URL('../data/articles/bundled-articles.json', import.meta.url);

const sql = await readFile(migrationUrl, 'utf8');
const marker = '$articles$';
const start = sql.indexOf(marker) + marker.length;
const end = sql.indexOf(marker, start);
if (start < marker.length || end < 0) throw new Error('Article JSON batch marker not found.');

const articles = JSON.parse(sql.slice(start, end)).map((article, index) => ({
  ...article,
  id: `bundled-${article.slug}-v1`,
  version: 1,
  published_at: new Date(Date.UTC(2026, 8, 1, 0, index, 0)).toISOString(),
}));

await mkdir(new URL('../data/articles/', import.meta.url), { recursive: true });
await writeFile(outputUrl, `${JSON.stringify(articles, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, generated: articles.length }));
