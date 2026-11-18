# Mosaic

Mosaic traces declared creative sources and derivatives to files in a local game or book export. It produces printable HTML credits and a JSON report with file hashes, missing outputs, unmapped files and evidence warnings. Its evidence covers supplied declarations and file identity. Review credits, permissions and license requirements separately.

Requires Node.js 20 or later. Run from this directory using Node's built-in modules. All scanning takes place locally.

```sh
node --test
node mosaic.mjs examples/manifest.json examples/game game game-credits examples/source
node mosaic.mjs examples/manifest.json examples/book book book-credits examples/source
```

Open the generated HTML in a browser to review or print the credits. The JSON contains file SHA-256 hashes, transitive source IDs and warnings. Exit status 0 means the scan completed. Review the warning list even when it completes successfully. Both adapters scan all regular files in the supplied directory, and the book adapter also carries declared page labels. Packed games, PDFs, archives, thumbnails, SQLite, embedded metadata and automatic REUSE imports are outside this workflow.

Choose a new report prefix outside both input directories. Mosaic reserves both report names before writing and attempts to remove its own reservations after a write failure. Keep the directories stable while scanning and writing reports.

## Manifest

Use the synthetic example as a starting point. `assets` list stable IDs, title, creator, source URL, an SPDX license expression where available, and evidence description. Blank or non-text creator, URL, license and evidence fields produce an incomplete-evidence warning. Mosaic records these values as declarations and leaves SPDX and REUSE validation to separate checks.

Set `source_path` and `evidence_path` to regular files relative to the source directory. Supply their expected hashes in `sha256` and `evidence_sha256`. A missing file, a directory in place of a file, or an absent or mismatched hash appears in the warning list. `derived_from` lists parent IDs. `outputs` maps exact slash-separated export paths to asset IDs, expected output `sha256` and an optional book page label. Keep paths within the selected roots and use regular paths without symlinks. Concurrent changes are outside the scan guarantees.

Mosaic credits the assets and ancestors associated with shipped files. The synthetic sample deliberately omits the expected output hash. Its declared source fixtures keep the pinned bytes across checkout settings. Matching hashes cover only byte identity. Verify attribution and license requirements separately.

## Related tools

Related projects include [Godot License Tracker](https://github.com/stesim/godot-license-tracker), [REUSE](https://reuse.readthedocs.io/en/latest/readme.html) and [Bynder/MONA](https://marketplace.bynder.com/en-US/apps/460204/mona).

MIT licensed; examples are synthetic.
