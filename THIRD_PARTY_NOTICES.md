# Third-Party Notices

This file collects the licenses, attributions, and required notices for
third-party code and data bundled or referenced by **Mini Grand Prix**.
The project itself is released under the MIT License (see [`LICENSE`](LICENSE)).

---

## npm dependencies

### `ws` (MIT License)

- **Version**: 8.21.3
- **Source**: <https://www.npmjs.com/package/ws>
- **Repository**: <https://github.com/websockets/ws>
- **Usage**: Local WebSocket server that connects the browser game to a phone
  used as a wireless gamepad in `server.js`.
- **Copyright**: Copyright (c) Einar Otto Stangvik <einaros@gmail.com>
- **License**: MIT — see below.

```text
MIT License

Copyright (c) Einar Otto Stangvik <einaros@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### `eslint` (MIT License)

- **Version**: 9.39.5
- **Source**: <https://www.npmjs.com/package/eslint>
- **Repository**: <https://github.com/eslint/eslint>
- **Usage**: Development-time linting (`npm run lint`).
- **Copyright**: Copyright OpenJS Foundation and contributors, <https://openjsf.org>
- **License**: MIT — see <https://github.com/eslint/eslint/blob/main/LICENSE> for
  the full text.

### `playwright-core` (Apache-2.0)

- **Version**: 1.61.1
- **Source**: <https://www.npmjs.com/package/playwright-core>
- **Repository**: <https://github.com/microsoft/playwright>
- **Usage**: Headless-browser smoke test (`npm run smoke`).
- **Copyright**: Copyright (c) Microsoft Corporation
- **License**: Apache-2.0 — full text at
  <https://www.apache.org/licenses/LICENSE-2.0>.
- **NOTICE**: Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License. You may
  obtain a copy of the License at <http://www.apache.org/licenses/LICENSE-2.0>.
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
  WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
  License for the specific language governing permissions and limitations
  under the License.

---

## Vendored code

### Project Nayuki — QR Code Generator (MIT License)

- **Source**: <https://github.com/nayuki/QR-Code-generator>
- **File**: [`scripts/qr-svg.js`](scripts/qr-svg.js)
- **Usage**: Generates the QR code SVG that lets a phone join as a wireless
  gamepad. `scripts/qr-svg.js` is a simplified, single-file rewrite of the
  upstream byte-mode + ECC level L encoder.
- **Copyright**: © Project Nayuki — <https://www.nayuki.io/page/qr-code-generator-library>
- **License**: MIT License — full text below. The upstream repository also
  offers a public-domain equivalent; this project uses the MIT option.

```text
MIT License

Copyright (c) Project Nayuki

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

- The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.
- The Software shall be used for Good, not Evil. If the source code or
  binary is used in an Evil organization, a donation of USD 100 to the author
  is appreciated.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> The "Good, not Evil" clause is preserved verbatim from the upstream notice.
> Where local law treats it as an unenforceable personal request rather than a
> binding obligation, the rest of the MIT terms continue to apply.

---

## Data

### Natural Earth — `world.geojson` (Public Domain)

- **Source file**: `world.geojson` at the repository root
- **Origin**: [Natural Earth](https://www.naturalearthdata.com/) 1:110m
  Physical vector data, **version 5.2.1** (downloaded 2026-07 from
  <https://www.naturalearthdata.com/downloads/110m-physical-vectors/>).
- **Usage**: Land polygons rendered on the 3D globe used to pick a circuit on
  the main menu.
- **License**: Public domain. No copyright — anyone may use, redistribute and
  adapt the data without restriction.
- **Suggested attribution** (not legally required):
  "Made with Natural Earth. Free vector and raster map data @
  naturalearthdata.com."

---

All third-party code and data remain subject to their respective licenses. The
MIT license of Mini Grand Prix itself applies only to this project's own
source code, not to the third-party components listed above.
