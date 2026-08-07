---
id: ogs-connection
title: OGS connection
subtitle: Playing unranked games on OGS
date: 2026-04-01T09:00:00
---

If you create an account here with OGS, or you [connect to OGS](/account/preferences/ogs), that enables some extra functionality on this site. First, the quick pairing buttons on the home page automatically create an unranked game on OGS. You can click the button again to cancel the game, and it also cancels itself after 60 seconds of searching if nobody joins. Second, in the lobby list of games, unranked OGS games you're eligible for will appear. You can disable either of these from the preferences page.

Note that unlike the default on OGS, games created from Libaduk use Chinese rules. This score is usually within 1 point of Japanese scoring, but remember to fill neutral "dame" points at the end of the game since it's worth points!

We don't store your OGS token or the associated refresh token in our database, which can lead to some bad user experiences. We try to catch connection errors and warn you about them, but if you experience issues please raise an issue [on Github](https://github.com/Seth-Rothschild/libaduk).
