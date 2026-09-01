import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'core', 'articles.ts');
const tempDir = path.join(root, 'tmp', 'article-seed');
const compiledPath = path.join(tempDir, 'articles.mjs');
const outputPath = path.join(root, 'supabase', 'articles-seed.sql');

await mkdir(tempDir, { recursive: true });
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
await writeFile(compiledPath, compiled, 'utf8');
const { fallbackArticles } = await import(`${pathToFileURL(compiledPath).href}?v=${Date.now()}`);

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${literal(JSON.stringify(value))}::jsonb`;
const textArray = (values) => `array[${values.map(literal).join(', ')}]::text[]`;

const rows = fallbackArticles.map((article) => `(
  ${literal(article.slug)},
  ${article.version},
  true,
  'PUBLISHED',
  ${literal(article.title)},
  ${literal(article.subtitle)},
  ${literal(article.excerpt)},
  ${literal(article.category)},
  ${textArray(article.tags)},
  ${article.reading_minutes},
  ${literal(article.difficulty)},
  ${literal(article.hero_kicker)},
  ${json(article.content_blocks)},
  ${json(article.thought_experiment)},
  ${json(article.practice)},
  ${json(article.source_notes)},
  'codex',
  ${literal(article.published_at)}::timestamptz
)`);

const sql = `begin;

insert into public.articles (
  slug, version, is_current, status, title, subtitle, excerpt, category, tags,
  reading_minutes, difficulty, hero_kicker, content_blocks, thought_experiment,
  practice, source_notes, author_agent, published_at
)
values
${rows.join(',\n')}
on conflict (slug, version) do nothing;

commit;
`;

await writeFile(outputPath, sql, 'utf8');
console.log(outputPath);
