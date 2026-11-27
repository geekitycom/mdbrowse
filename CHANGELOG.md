# Changelog

## [1.9.0](https://github.com/geekitycom/mdbrowse/compare/mdbrowse-v1.8.0...mdbrowse-v1.9.0) (2026-11-27)


### Features

* show markdown files on github as their raw files ([5456869](https://github.com/geekitycom/mdbrowse/commit/545686975dcc09d13895da1c91f8fa5f02e2f630))

## [1.8.0](https://github.com/geekitycom/mdbrowse/compare/mdbrowse-v1.7.0...mdbrowse-v1.8.0) (2026-11-27)


### Features

* open documents linked through md.geekity.com directly ([7ccd2a4](https://github.com/geekitycom/mdbrowse/commit/7ccd2a43bb9c2dc81b9c7ca3a41cec035b707c66))
* open documents linked through other markdown viewers directly ([b830079](https://github.com/geekitycom/mdbrowse/commit/b830079b87ce1349379b0bf1dc397cd58f4287a4))

## [1.7.0](https://github.com/geekitycom/mdbrowse/compare/mdbrowse-v1.6.0...mdbrowse-v1.7.0) (2026-11-27)


### Features

* hide images that fail to load ([5e2ead8](https://github.com/geekitycom/mdbrowse/commit/5e2ead8167f7d11671ae820545053628f59e7ead))
* load the start page from a configurable URL ([970569a](https://github.com/geekitycom/mdbrowse/commit/970569a169c5bff50380643e67d787d25026e7f3))


### Bug Fixes

* send images without a referrer so hotlink-protected hosts serve them ([efbcb6f](https://github.com/geekitycom/mdbrowse/commit/efbcb6f189a516df7d7793f1244bb8290bd23617))

## [1.6.0](https://github.com/geekitycom/mdbrowse/compare/mdbrowse-v1.5.0...mdbrowse-v1.6.0) (2026-11-22)


### Features

* link feeds listed in front matter ([4c91dad](https://github.com/geekitycom/mdbrowse/commit/4c91dad3befb7ba4c5c30d8b130e1ef01665512d))
* link to pages mdbrowse can't show, and only read text/plain as markdown by name ([0582802](https://github.com/geekitycom/mdbrowse/commit/0582802ed0f680fc44752af1c71d7d4a1b8bfef9))
* show rss 2.0 feeds, with item bodies from source:markdown ([455f519](https://github.com/geekitycom/mdbrowse/commit/455f519e13aa370fdc80cf9ca1d6c86fe7bc6ec5))

## [1.5.0](https://github.com/geekitycom/mdbrowse/compare/mdbrowse-v1.4.0...mdbrowse-v1.5.0) (2026-11-21)


### Features

* fill {{ page.field }} placeholders from front matter ([a6678df](https://github.com/geekitycom/mdbrowse/commit/a6678dfc5ac63aacab2dba38be8b0344e0673b0c))

## [1.4.0](https://github.com/geekitycom/mdbrowse/compare/mdbrowse-v1.3.1...mdbrowse-v1.4.0) (2026-10-29)


### Features

* keep gemini and other safe non-web links in documents ([6d2b3a9](https://github.com/geekitycom/mdbrowse/commit/6d2b3a96454e0a2a9b4703ecfa9297e1a196308e))

## [1.3.1](https://github.com/geekitycom/mdbrowse/compare/mdbrowse-v1.3.0...mdbrowse-v1.3.1) (2026-10-24)


### Bug Fixes

* **docker:** copy alternate.js into the image ([21063e1](https://github.com/geekitycom/mdbrowse/commit/21063e164dcb97a52240f01bcc6a183434032ad8))
* **docker:** copy alternate.js into the image ([aa58a0c](https://github.com/geekitycom/mdbrowse/commit/aa58a0cda57e15ced39b22c489faaf015333a846))

## [1.3.0](https://github.com/geekitycom/mdbrowse/compare/mdbrowse-v1.2.1...mdbrowse-v1.3.0) (2026-10-24)


### Features

* follow &lt;link rel="alternate" type="text/markdown"&gt; on HTML pages ([a9a2be1](https://github.com/geekitycom/mdbrowse/commit/a9a2be1563b0acd36adc20c72fbc212fea32efc6))
* follow &lt;link rel="alternate" type="text/markdown"&gt; on HTML pages ([032db0b](https://github.com/geekitycom/mdbrowse/commit/032db0bd759493729a3d0b7e4fd2937d04064eb4))

## [1.2.1](https://github.com/geekitycom/mdbrowse/compare/mdbrowse-v1.2.0...mdbrowse-v1.2.1) (2026-10-23)


### Bug Fixes

* **deps:** patch dompurify advisories and Node October 2026 CVEs ([de9d5ae](https://github.com/geekitycom/mdbrowse/commit/de9d5ae4ced1204a481f6b9c5bad251e48d901d2))

## [1.2.0](https://github.com/geekitycom/mdbrowse/compare/mdbrowse-v1.1.0...mdbrowse-v1.2.0) (2026-10-08)


### Features

* hand non-markdown links to the browser and open links in new tabs ([2ed4c6b](https://github.com/geekitycom/mdbrowse/commit/2ed4c6b524c4a13e5ff6b059e39e802533dff836))
* show a document's updated date in the status line ([ba82fef](https://github.com/geekitycom/mdbrowse/commit/ba82fef5fa64de48c01704278b855696ebb552b3))
* show front matter navigation in the status bar ([b947188](https://github.com/geekitycom/mdbrowse/commit/b9471880e9f80517c54f565378c221918d889dc7))
* use front matter title and navigation, and narrow the reading column ([1ed9743](https://github.com/geekitycom/mdbrowse/commit/1ed9743c281fa72b048b53d0167847ab2efb2804))


### Bug Fixes

* drop a UTF-8 byte order mark from fetched documents ([ed79b6e](https://github.com/geekitycom/mdbrowse/commit/ed79b6ed72f94dc89bc780367cd6654028b43b8e))

## [1.1.0](https://github.com/geekitycom/mdbrowse/compare/mdbrowse-v1.0.0...mdbrowse-v1.1.0) (2026-10-07)


### Features

* add Docker image and dockge deploy ([73efbd9](https://github.com/geekitycom/mdbrowse/commit/73efbd9607aba2c1f06fab655d1fa17dac1253c5))
* fall back to /llms.txt when a site root has no markdown ([a7d4d3d](https://github.com/geekitycom/mdbrowse/commit/a7d4d3d243d46be2251ac8c8dfca0498cd60aaf1))
* show homepage.md at / with a home button ([107e600](https://github.com/geekitycom/mdbrowse/commit/107e600a680fc2a7cedf9d355ce0faa1e57cdf27))


### Bug Fixes

* refuse private network addresses in the markdown fetcher ([333b13b](https://github.com/geekitycom/mdbrowse/commit/333b13b3f7d75e32a335d2dad86fdfbb524b7ab7))
