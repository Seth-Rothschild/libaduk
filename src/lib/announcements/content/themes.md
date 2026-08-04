---
id: themes
title: Themes
subtitle: Changing the board and stones
date: 2026-05-05T09:00:00
---

We've added support for using custom images for the board and stones. From Board settings, you can upload themes that were made for [Sabaki](https://github.com/SabakiHQ/Sabaki) and all boards within the site will use that theme. For example themes you can download, check [here](https://github.com/SabakiHQ/Sabaki/blob/master/docs/guides/theme-directory.md).

Right now, we only support [.asar](https://github.com/electron/asar) archive files because that's what Sabaki used. This wouldn't have been my first choice, but there are plenty of themes floating around the internet already in that format. The files are stored directly in your browser in an IndexedDB, so you can switch between any theme you've uploaded to that browser.

The site does not have full support for changing everything that Sabaki themes allowed. If there's a theme you'd like to use that's working badly for you, just [let me know](https://github.com/Seth-Rothschild/libaduk/issues) and I can make the necessary updates to theme handling.
