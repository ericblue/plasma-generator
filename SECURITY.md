# Security policy

## Supported version

The current default branch is supported. This is a static client-side application
and has no server-side account or data storage component.

## Reporting a vulnerability

Please do not include exploit details in a public issue. Contact the repository
owner privately through the security-reporting channel configured on the hosting
platform. Include the affected URL or file, browser/version, reproduction steps,
and likely impact. You should receive an acknowledgement within seven days.

Microphone analysis is disabled in shipped builds (`AUDIO_REACTION_ENABLED` in
`web/src/main.ts`); no build requests microphone permission. The code path remains
in the tree, and when enabled it is opt-in, runs in the browser, and is neither
uploaded nor included in WebM recordings. Preset files are parsed as JSON and
converted through the same validated URL-state path used by share links.
