# Mosaic

Mosaic is an alpha, offline release-provenance prototype. It traces declared creative sources and derivatives to files in a game or book export, then produces HTML credits and a JSON report. It makes unmapped files, missing outputs, missing evidence, and output hash mismatches visible. It does not discover ownership or prove license compatibility, permission, or legal compliance. Review all declarations and generated credits.

Requires Node.js 20 or later; no dependencies or network access. From this directory:

```sh
node --test
node mosaic.mjs examples/manifest.json examples/game game game-credits examples/source
node mosaic.mjs examples/manifest.json examples/book book book-credits examples/source
```

Open the generated HTML in a browser to print; the JSON contains file SHA-256 hashes, transitive source IDs and warnings. Write reports outside the scanned directory so they do not appear as unmapped files on subsequent runs. All files in an export are scanned; there is no extension filter. Exit status 0 means the scan completed, not that warnings are absent. Both adapters scan ordinary directories; the book adapter additionally carries declared page labels. Packed games, PDFs, archives, thumbnails, SQLite, embedded metadata and automatic REUSE imports are not supported.

Reports must be written outside both input directories. Both report names are reserved exclusively before writing, so existing files are never overwritten; choose a new prefix for each run. On a write failure Mosaic attempts to remove only the files it reserved and reports cleanup errors. As with scanning, avoid concurrent changes to the directories during report creation.

## Manifest

Edit the synthetic example. `assets` list stable IDs, title, creator, source URL, an SPDX license expression where available, and evidence description. Set `source_path` and `evidence_path` relative to the explicit source directory, with expected hashes in `sha256` and `evidence_sha256`. `derived_from` lists parent IDs. `outputs` maps exact slash-separated paths relative to the export directory to asset IDs, with expected output `sha256` and an optional book page label. Missing expected hashes are warnings. Mosaic computes hashes from files and compares them with the declarations; missing, changed, and unverified files are reported. The sample intentionally omits output hashes to illustrate that warning. Multiple ancestors are credited when a derivative ships. Assets declared but not linked to shipped files do not appear in credits. Paths cannot traverse upward or use symlinks. Keep both input directories stable during a scan; concurrent filesystem changes are not guarded against. A matching hash establishes only byte identity, not ownership, permission, authenticity, or license compliance. Verify attribution requirements manually. The tool does not validate SPDX expressions or implement REUSE compliance.

## Positioning

[Godot License Tracker](https://github.com/stesim/godot-license-tracker) already manages third-party asset licenses in Godot. [REUSE](https://reuse.readthedocs.io/en/latest/readme.html) helps document and check license metadata, while [Bynder/MONA](https://marketplace.bynder.com/en-US/apps/460204/mona) addresses managed digital rights. Mosaic explores a smaller cross-format question: which declared creative lineage is associated with the files in this particular export? It is not a replacement for these tools or evidence that the idea is unique.

MIT licensed; examples are synthetic.
