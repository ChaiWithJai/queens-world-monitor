import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const outputDirectory = new URL('../dist-queens/', import.meta.url);
const indexPath = new URL('index.html', outputDirectory);
const queensPath = new URL('queens.html', outputDirectory);
const deployHeadersPath = new URL('_headers', outputDirectory);

await Promise.all([access(indexPath), access(queensPath)]);

const [indexHtml, queensHtml, outputFiles] = await Promise.all([
  readFile(indexPath, 'utf8'),
  readFile(queensPath, 'utf8'),
  readdir(outputDirectory, { recursive: true }),
]);

assert.equal(indexHtml, queensHtml, 'root index must match the Queens entrypoint');
assert.match(indexHtml, /<title>Queens World Monitor — MBIQ<\/title>/);
assert.match(indexHtml, /class="qm-brand" href="\/"/);
assert.doesNotMatch(indexHtml, /href="\/queens(?:\.html)?"/);
assert.match(indexHtml, /src="\/assets\/queens-[^"]+\.js"/);
assert.match(indexHtml, /href="\/assets\/queens-[^"]+\.css"/);
assert.ok(outputFiles.some((file) => /^assets\/queens-.+\.js$/.test(file)));
assert.ok(outputFiles.some((file) => /^assets\/queens-.+\.css$/.test(file)));

if (process.env.CONTEXT && process.env.CONTEXT !== 'production') {
  const deployHeaders = await readFile(deployHeadersPath, 'utf8');
  assert.match(deployHeaders, /X-Robots-Tag: noindex, nofollow/);
} else {
  await assert.rejects(
    access(deployHeadersPath),
    'production output must not include the non-production noindex header',
  );
}

for (const forbidden of ['api/', 'server/', 'blog/', 'workers/']) {
  assert.ok(
    outputFiles.every((file) => !file.startsWith(forbidden)),
    `standalone deploy must not publish inherited ${forbidden} content`,
  );
}

const absoluteOutput = join(outputDirectory.pathname, 'index.html');
console.log(`Verified standalone Queens deploy artifact: ${absoluteOutput}`);
