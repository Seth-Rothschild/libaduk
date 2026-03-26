# libaduk.com

A Go game platform that looks and feels like [Lichess](https://lichess.org). Here we've taken the css from [lila](https://github.com/lichess-org/lila) the open-source Scala/Play server behind Lichess and applied the css to a Svelte app.

This code is a prototype and has made heavy use of LLMs to get it where it is. It is far from fully functional. Demo site is up at [libaduk.com](https://libaduk.com). Feel free to fork and make changes to suit your needs!

![](./screenshots/main.png)

## Provenance

Large parts of both code and inspiration have been taken from [lila](https://github.com/lichess-org/lila), and this repository happily preserves its AGPL license. Go [support that project](https://lichess.org/patron)!

The game board, board logic, and board feel are heavily inspired by [Sabaki](https://github.com/SabakiHQ) and uses Sabaki components where possible.

The client-side AI uses KataGo ONNX models served by [Kaya](https://github.com/kaya-go/kaya), running in-browser via ONNX Runtime Web.

![](./screenshots/gameplay.png)

## Roadmap and Anti-Roadmap

Right now I'm not interested in replacing OGS or further partitioning the Go community. This code exists to demonstrate _how_ the Lichess UI can be used for Go.

If _you_ are interested in deploying this or forking it to suit some other need, I'd be happy to help. It is easy to imagine using this code as an OGS frontend or using the backend to connect existing desktop apps.

The features I'm most interested in right now are:

- **Puzzles** - Lichess puzzles and puzzle UI are one of the highlights of the site. Having a free and open source "Puzzle of the day" with a nice UI would be a win for the go community.
- **More Go Basics** - This code should be mostly functional for casual play. I just wanted a place where I could play online and review the code afterwards with humans. However, there are some basic features (e.g. visible rankings) that are not yet implemented.

The following are not currently planned:

- **Game verification/Anti-cheat** - Right now gamestate is only verified by the clientside code and assumes everyone is a good citizen. In the unlikely event the users become a problem on [libaduk.com](libaduk.com) the code will remain open source but I'll just shut the site off and leave it for someone else to deploy.

## Development

### Setup

First install [Node.js](https://nodejs.org/) and [MongoDB](https://www.mongodb.com/docs/manual/installation/). Then:

```sh
npm install

# Start MongoDB (in a separate terminal)
mongod --dbpath data/mongo

# Start the dev server
npm run dev
```

### Other commands

```sh
npm run storybook   # component explorer
npm run test        # unit + component tests
npm run test:e2e:ui # interactive e2e test runner
npm run build       # production build
npm start           # run production server
```
