# Third-party notices and historical credits

This file records provenance and permissions. The repository's MIT license
applies only where the project has the right to grant it.

## Bret Mulvey — PLASMA (1988)

The Mulvey compatibility mode is based on the behavior and surviving source of
**PLASMA**, written by Bret Mulvey. Its original documentation states:

> Program and documentation copyright 1988 by Bret Mulvey

No explicit redistribution or derivative-work license was found in the archive.
The public repository therefore excludes the original Pascal source, executable,
documentation, and archive.

**Permissions decision, recorded 2026-09-18.** This project publishes two
Mulvey-derived items without having obtained permission, in good faith and for
historical preservation: the surviving `PLASMA.IMG` artifact (shipped unchanged
as `web/public/plasma-1988.img`) and a compatibility implementation ported from
`PLASMA.PAS` (`web/src/generators/diamondSquare.ts` and the palette wheel in
`web/src/palette.ts`). The underlying diamond-square algorithm is Fournier,
Fussell and Carpenter (1982) and is not claimed by anyone here; what is
preserved from Mulvey's program is its specific behavior, so that a
compatibility mode is actually compatible.

No permission is claimed or implied, and the wide availability of the archive on
preservation sites is not treated as one. Bret Mulvey retains all rights in his
1988 program and its output. **If Bret Mulvey, or anyone acting for him, asks for
any of this material to be removed or changed, the request will be honored
promptly and without argument** — contact the repository owner through the route
in `SECURITY.md` or by opening an issue.

The historical archive used for this project was downloaded from the
[Demozoo production page for Plasma](https://demozoo.org/productions/129255/),
which identifies **Bret Mulvey** as its author, dates the MS-DOS demo to April
1988, and links to preserved downloads at scene.org and Defacto2. The scene.org
archive contains `PLASMA.DOC`, `PLASMA.EXE`, `PLASMA.IMG`, and `PLASMA.PAS`.
The downloaded 51,600-byte archive matches the preserved scene.org file; its
SHA-256 is
`b63bcc55e39c04f693851b178ce5671d47349bf2c242b1bbb22623b2bde338a8`.
These archival listings establish provenance and public availability, but they
are not treated as a license or permission from Bret Mulvey.

Copyright © 1988 Bret Mulvey. All rights not expressly granted remain with their
respective owner.

## Tom Dibble — Tom's Plasma 1.1 (1994)

The Tom's Plasma compatibility mode ports the fractal generator, palette
animation, movement-table interpretation, and “swimming” compositor written by
**Tom Dibble**. The program and manual identify Tom Dibble as author and state
copyright 1994.

The historical package used for this port was obtained from the
[Eyecandy Archive's Tom's Plasma page](http://eyecandyarchive.com/Tom%27s%20Plasma/),
which identifies the program as “Freeware © Tom Dibble” and provides the
original MS-DOS archive. That archive contains `PLASDAT.C`, `TPLAS.ASM`,
`TPLAS.DOC`, `TPLAS.COM`, `TOMSPLAS.DAT`, and `PLASDAT.EXE`. The archive was
retrieved on September 2, 2026; its SHA-256 is
`1a7e631ce4d3a3f494c89f042ef7a880eed55698e17405242ff8ae117ecc0a80`.
The archive page documents public availability, while the reuse basis for this
port is the author's permission in `TPLAS.DOC` described below.

Tom's manual grants permission to use the included code in any manner provided
that Tom is credited and directly derived code allows the same freedom of use. It
summarizes the condition as: “use it as you want, give me credit, and don't stop
anyone else from using it.” This notice and the permissive repository license are
intended to preserve those conditions.

The unchanged `toms-plasma-1994.dat` runtime data is derived from the historical
`TOMSPLAS.DAT` artifact. Its SHA-256 is
`8628b181cec3b5c365a11bb86b23ad953d65175e31692505899f14a36b4d596d`.

Copyright © 1994 Tom Dibble.

## “Swimming” effect lineage

Tom Dibble's manual says that he first encountered the swimming technique in
**JCL-Plasm** by **Jeremy Longley**, who in turn credited **Thomas Hagen**. This
project preserves that historical attribution; it does not claim that Tom
originated the underlying technique.

## Modern project

The web application, new Demoscene generator and effects, interface, tests, and
documentation were created as a modernization experiment initiated by **Eric
Blue** in 2026, with Anthropic Claude and OpenAI Codex used as development and
analysis tools.

Product names and artist-inspired palette labels are descriptive. The palettes
are original color impressions and are not sampled reproductions of artworks.
