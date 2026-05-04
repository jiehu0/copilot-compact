# Changelog

All notable changes to Copilot Compact will be documented in this file.

## [0.0.1] - 2026-05-04

### Added

- Detect Copilot/OAI-compatible conversation compaction requests.
- Rewrite matched `POST /responses` requests to `POST /responses/compact`.
- Resolve matching compact channels from `/models` and send the base model to `/responses/compact`.
- Adapt compact responses for Copilot by storing opaque compaction items and expanding them in later requests.
- Add configurable host allow-list, rewrite mode, compact model override, and log level.
- Add bilingual README content and Marketplace-ready metadata.
