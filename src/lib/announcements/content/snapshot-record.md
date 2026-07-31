---
id: game-record
title: Recording and sharing live games
subtitle: Functionality for the 2026 US Go Congress
date: 2026-07-29T07:20:19
---

There are two updated features for recording games played in person.

First, there is [the kifu page](/kifu) for manually writing moves while playing. I think this page is pretty cool looking. It's meant to feel similar to writing moves on paper during a game. There's also functionality to edit and save the gametree, and once saved you can create a QR code to share a link to the game.

Second, lots of people use video to record their games and then they copy games from video into an SGF. I've added a page [Snapshot Record](/snapshot-record) to simplify that setup: games are still stored locally on your phone with as little power consumption as possible. Then when you're done, there's an interface to go frame by frame to copy the game over from the video. Automatic stone detection has been a [long time interest](https://github.com/Seth-Rothschild/goban_irl) of mine. That functionality is built in here, but I would definitely recommend checking for correctness before trusting it.
