#!/usr/bin/env node
import {readFile, readdir, lstat, realpath, open, unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validatePath(value, label) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\') || value.includes(':') || value.split('/').some(x => !x || x === '.' || x === '..')) throw Error(`Invalid ${label} path: ${value}`);
}
async function safeRead(root, relative) {
  validatePath(relative, 'input');
  let current = path.resolve(root);
  if ((await lstat(current)).isSymbolicLink()) throw Error(`Symlink root not supported: ${current}`);
  for (const component of relative.split('/')) {
    current = path.join(current, component);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw Error(`Symlink not supported: ${current}`);
  }
  return readFile(current);
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function verifyFile(root, filename, expected) {
  if (!filename) return {status:'missing-path'};
  validatePath(filename,'input');
  if (!root) return {path:filename,status:'missing-root'};
  try {
    const sha256 = digest(await safeRead(root,filename));
    return {path:filename,sha256,status:!expected ? 'missing-expected-hash' : expected.toLowerCase() === sha256 ? 'matched' : 'hash-mismatch'};
  } catch (e) {
    if (e.code === 'ENOENT') return {path:filename,status:'missing-file'};
    throw e;
  }
}
async function files(root, dir = root) {
  if ((await lstat(dir)).isSymbolicLink()) throw Error(`Symlink not supported: ${dir}`);
  const result = [];
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw Error(`Symlink not supported: ${full}`);
    if (entry.isDirectory()) result.push(...await files(root, full));
    else if (entry.isFile()) result.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return result.sort();
}
export async function inspect(manifest, root, kind, sourceRoot) {
  if (!['game','book'].includes(kind)) throw Error('Adapter must be game or book');
  if (!Array.isArray(manifest.assets) || !Array.isArray(manifest.outputs)) throw Error('Manifest needs assets and outputs arrays');
  const assets = new Map();
  for (const a of manifest.assets) {
    if (!a.id || assets.has(a.id)) throw Error('Asset IDs must be unique and nonempty');
    assets.set(a.id,a);
  }
  function lineage(id, stack = []) {
    if (!assets.has(id)) throw Error(`Unknown asset: ${id}`);
    if (stack.includes(id)) throw Error(`Derivative cycle: ${[...stack,id].join(' -> ')}`);
    const a = assets.get(id);
    return [a, ...(a.derived_from || []).flatMap(parent => lineage(parent,[...stack,id]))];
  }
  for (const a of assets.values()) lineage(a.id);
  const shipped = await files(root), mapping = new Map();
  for (const o of manifest.outputs) {
    validatePath(o.path,'output');
    if (mapping.has(o.path)) throw Error(`Duplicate output: ${o.path}`);
    if (!Array.isArray(o.assets) || !o.assets.length) throw Error(`Output needs assets: ${o.path}`);
    o.assets.forEach(id => lineage(id)); mapping.set(o.path,o);
  }
  const credits = new Map(), outputs = [];
  for (const filename of shipped) {
    const sha256 = digest(await safeRead(root,filename));
    const declared = mapping.get(filename);
    const ids = declared ? [...new Set(declared.assets.flatMap(id => lineage(id).map(a=>a.id)))] : [];
    for (const id of ids) credits.set(id, assets.get(id));
    outputs.push({path:filename,sha256,page:kind === 'book' ? (declared?.page ?? null) : undefined,assets:ids, status:declared ? (!declared.sha256 ? 'missing-expected-hash' : declared.sha256.toLowerCase() !== sha256 ? 'hash-mismatch' : 'mapped') : 'unmapped'});
  }
  const warnings = [];
  for (const o of outputs) if(o.status !== 'mapped') warnings.push(`${o.status}: ${o.path}`);
  for (const o of manifest.outputs) if (!shipped.includes(o.path)) warnings.push(`missing output: ${o.path}`);
  const verification = [];
  for (const a of credits.values()) {
    if (!a.creator || !a.source_url || !a.license || !a.evidence) warnings.push(`incomplete evidence: ${a.id}`);
    const source = await verifyFile(sourceRoot,a.source_path,a.sha256);
    const evidence = await verifyFile(sourceRoot,a.evidence_path,a.evidence_sha256);
    verification.push({asset:a.id,source,evidence});
    if (source.status !== 'matched') warnings.push(`source ${source.status}: ${a.id}`);
    if (evidence.status !== 'matched') warnings.push(`evidence ${evidence.status}: ${a.id}`);
  }
  return {schema:'mosaic-report-2',adapter:kind,outputs,credits:[...credits.values()],verification,warnings};
}
export function html(report) {
  const credits = report.credits.map(a=>`<li><strong>${esc(a.title || a.id)}</strong> — ${esc(a.creator || 'Creator unknown')}<br>License: ${esc(a.license || 'unknown')} · Source: ${esc(a.source_url || 'unknown')}<br>Evidence: ${esc(a.evidence || 'missing')}</li>`).join('\n');
  const warnings = report.warnings.map(w=>`<li>${esc(w)}</li>`).join('\n');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Release credits</title><style>body{font:16px/1.6 system-ui;max-width:48rem;margin:3rem auto;padding:0 1rem}li{margin:1rem 0}@media print{body{margin:0}}</style><h1>Release credits</h1><p>Based on declarations and files scanned. Review before publication.</p><ul>${credits}</ul><h2>Needs review</h2><ul>${warnings || '<li>None detected; declarations still require review.</li>'}</ul></html>`;
}
function inside(root, candidate) {
  const relative = path.relative(root,candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
// Reserve both output names before writing either one. Existing files, including
// inputs and prior reports, are never opened for writing.
export async function writeReports(prefix, report, protectedRoots) {
  const names = [`${prefix}.json`,`${prefix}.html`];
  const roots = await Promise.all(protectedRoots.map(root => realpath(root)));
  const targets = [];
  for (const name of names) {
    const absolute = path.resolve(name);
    const parent = await realpath(path.dirname(absolute));
    const target = path.join(parent,path.basename(absolute));
    if (roots.some(root => inside(root,target))) throw Error(`Report output must be outside input directories: ${name}`);
    targets.push(target);
  }
  const opened = [];
  try {
    for (const target of targets) {
      const handle = await open(target,'wx');
      opened.push({target,handle,stat:await handle.stat()});
    }
    await opened[0].handle.writeFile(JSON.stringify(report,null,2)+'\n');
    await opened[1].handle.writeFile(html(report));
  } catch (error) {
    for (const item of opened) {
      try { await item.handle.close(); item.closed = true; }
      catch (closeError) { error.message += `; close failed for ${item.target}: ${closeError.message}`; }
      try {
        const current = await lstat(item.target);
        if (current.dev === item.stat.dev && current.ino === item.stat.ino) await unlink(item.target);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') error.message += `; cleanup failed for ${item.target}: ${cleanupError.message}`;
      }
    }
    throw error;
  } finally {
    await Promise.all(opened.filter(item => !item.closed).map(item => item.handle.close()));
  }
}
async function main() {
  const [manifestFile,root,kind,out,sourceRoot] = process.argv.slice(2);
  if (!out || !sourceRoot) throw Error('Usage: node mosaic.mjs manifest.json export-directory game|book report-prefix source-directory');
  const manifest = JSON.parse(await readFile(manifestFile,'utf8'));
  const report = await inspect(manifest,root,kind,sourceRoot);
  await writeReports(out,report,[root,sourceRoot]);
  console.log(`${report.outputs.length} files, ${report.credits.length} credited assets, ${report.warnings.length} warnings`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e=>{console.error(e.message);process.exitCode=1});
