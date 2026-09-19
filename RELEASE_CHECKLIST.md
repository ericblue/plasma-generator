# Public release checklist

## Required rights decision

- [x] Decide the Mulvey question. **Decided 2026-09-18: ship as-is** — the
  compatibility port and `web/public/plasma-1988.img` are published without
  permission, in good faith, for historical preservation. Permission was not
  sought. Revisit if Mulvey is ever contacted or makes contact.
- [x] Record the decision in `THIRD_PARTY_NOTICES.md`, including that no
  permission is claimed, that archival availability is not treated as a license,
  and a standing commitment to honor a removal request promptly.
- [x] Confirm that distribution of Tom's `TOMSPLAS.DAT` data artifact is covered
  by the archive's reuse grant — yes: `TPLAS.DOC` grants use with credit and
  onward freedom, recorded in `THIRD_PARTY_NOTICES.md` with the archive SHA-256.

## Repository contents

- [ ] Initialize the public Git repository from a clean checkout/staging folder.
- [ ] Verify `git status --ignored` excludes `files/`, `programs/`, `run/`,
  `dosbox/`, original executables, and source archives.
- [ ] Inspect every tracked binary and generated image for provenance.
- [ ] Confirm `LICENSE`, `THIRD_PARTY_NOTICES.md`, author credits, and source-file
  headers are present in the release artifact.

## Quality and security

- [x] Run `yarn install --frozen-lockfile`, `yarn build`, and `yarn test` in
  `web/` on a clean machine. (Build + 11/11 Playwright tests green 2026-09-18;
  clean-machine run still pending — CI covers this on first push.)
- [ ] Run the **full** suite locally with a GPU (`cd web && yarn test`, no `CI`
  env set). Two tests are skipped on CI because they rasterize UHD and
  full-quality trails, which is infeasible on a GPU-less runner -- a local run is
  the only thing that covers them. All 11 must pass.
- [ ] Test Chromium, Firefox, Safari/WebKit, mobile layout, keyboard controls,
  fullscreen, presentation mode, PNG, WebM, JSON presets, and offline reload.
- [x] Confirm `AUDIO_REACTION_ENABLED` is still `false` and no build prompts for
  microphone permission, until the audio response curve is tuned and tested.
- [x] Review production dependencies and GitHub Actions permissions.
  (`ci.yml` is `permissions: contents: read`.)
- [x] Confirm the service-worker cache name was bumped for any release that
  changes cached shell/data behavior. (`plasma-v7` -> `plasma-v8`, 2026-09-18.)

## Project presentation

- [ ] Add repository description, screenshots, topics, and a hosted demo URL.
- [ ] Enable private vulnerability reporting and configure the contact route
  referenced by `SECURITY.md`.
- [ ] Create a version tag and release notes that distinguish fidelity fixes from
  new visual features.
