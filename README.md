# libaduk-svelte

A Go game platform that looks and feels like [Lichess](https://lichess.org). Here we've taken the css from [lila](https://github.com/lichess-org/lila) the open-source Scala/Play server behind Lichess and applied the css to a Svelte app.

This code is a prototype and has made heavy use of LLMs to get it where it is. It is far from fully functional. Feel free to fork and test locally, but deploy at your own risk.

![](./screenshot.png)

## Provenance

Large parts of both code and inspiration have been taken from lila, and this repository happily preserves its AGPL license. Go [support that project](https://lichess.org/patron)!

The game board, board logic, and board feel is heavily inspired by [Sabaki](https://github.com/SabakiHQ) and uses Sabaki components where possible.

## Development

```sh
npm install
npm run dev         # start dev server
npm run storybook   # component explorer
npm run test        # unit + component tests
npm run build       # production build
```
