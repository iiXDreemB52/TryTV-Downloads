# TryTV Downloads

Official TryTV Windows release packages. Download the latest Windows portable zip from Releases, extract it and launch `TryTV.exe`.

TryTV only supports media sources and playback where applicable use is authorized. Each source requires admin review. Source availability and compatibility can change.

## Central episode and chapter map refresh

The GitHub Actions workflow `.github/workflows/refresh-episode-maps.yml` schedules a **centralized refresh every 5 minutes** (GitHub may start scheduled jobs late). It reads `trytv/approved-sources.json` on each run, so newly approved sources automatically enter the scan **once an initial verified work-route map has been published**. No end-user installation crawls sources.

For each approved source with eligible mapped series/comics, it checks an RSS feed when available and samples up to three existing work pages per five-minute cycle. This rolling work-page scan allows sites without RSS, including manga/manhwa sources, to receive updates over time. A source without a valid feed does **not** have every individual work checked every five minutes. Provider adapters can add richer discovery for faster detection.

Episode/chapter URLs are never inferred from a missing number. A new link must be published by the approved provider, match an existing verified work route, and serve a valid HTML page. The updater merges new entries without deleting old ones, preserves the original chapter order, updates work summaries, increments the central manifest revisions and recalculates shard SHA-256 hashes. Publishing happens only when there are actual verified additions.

The workflow uses bounded parallelism, 10.5-second request timeouts and a 115-second scan budget to avoid hammering providers or causing overlapping runs. Administrator/source-provider request volume and GitHub Actions usage increase with the number of approved sources; end-user CPU and bandwidth do not scale with the central scan frequency.

To run an individual source or a dry run:
```sh
node scripts/refresh-episode-routes.cjs --dry-run --target=example-series
node scripts/validate-episode-maps.cjs
```
