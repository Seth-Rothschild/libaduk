# libaduk-svelte

A Go game platform that looks and feels like [Lichess](https://lichess.org). Here we've taken the css from [lila](https://github.com/lichess-org/lila) the open-source Scala/Play server behind Lichess and applied the css to a Svelte app.

This code is a prototype and has made heavy use of LLMs to get it where it is. It is not yet functional nor is it deployed anywhere.


## Provenance
Large parts of both code and inspiration have been taken from lila, and this repository happily preserves its AGPL license. Go support that project!


## Development

```sh
npm install
npm run dev         # start dev server
npm run storybook   # component explorer
npm run test        # unit + component tests
npm run build       # production build
```