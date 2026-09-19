# Contributing

Thanks for helping preserve and extend Plasma.

## Development workflow

1. Work in `web/`; the application is dependency-light TypeScript and WebGL2.
2. Run `yarn build`, `yarn test:generator`, and `yarn test:visual` before opening
   a pull request.
3. Explain whether a change affects an authentic historical path, a modern path,
   or the Demoscene generator.
4. Update or add deterministic/visual coverage when rendering changes are
   intentional. Regenerate baselines with `yarn test:visual:update` and describe
   the visible difference in the pull request.

## Fidelity rules

- Keep authentic behavior available and deterministic. New visual improvements
  should be options or modern render paths, not silent changes to the baseline.
- Preserve source attribution in comments and `THIRD_PARTY_NOTICES.md`.
- Do not add original archives, DOS executables, historical source trees, or
  other unreviewed binary artifacts.
- New third-party code or data must have a documented, redistribution-compatible
  license and be added to the notices file.

## Code style

Prefer clear TypeScript and small browser APIs over new runtime dependencies.
Keep accessibility, keyboard use, reduced-motion behavior, and mobile layouts in
mind. Avoid making microphone or other permission-sensitive features automatic.

By contributing, you agree that your contribution may be distributed under the
repository's MIT license and any applicable third-party conditions already noted.
