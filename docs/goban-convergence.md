# Goban convergence plan

Decided 2026-08-02. Context: the OGS gamedata migration (ea7ea90) converged the wire
protocol and storage shape on OGS's format, but net line count went _up_ (+100) and three
post-migration bugs (rank NaN, AI score approval, analysis color flip) all lived in
hand-rolled code that reimplements things goban-engine already ships.

## Premise

Trust hierarchy: goban's code > goban's shape > code we write. The migration adopted the
shape but kept hand-rolled producers and consumers on both ends. The OGS shape only pays
off when goban's own consumer code is what operates on it. Adopt OGS's protocol
_semantics and code_, delete our consumers. Do not invent libaduk-local shapes — for
anything OGS has a concept for, use OGS's concept verbatim; for other servers (KGS),
translate at the server boundary into OGS vocabulary so the client speaks exactly one
dialect.

## The four moves

### 1. Typecheck against goban's protocol types (STATUS: in progress)

goban-engine ships OGS's protocol as .d.ts: `engine/protocol/ClientToServer.d.ts`,
`ServerToClient.d.ts`. `GobanSocket<SendProtocol, RecvProtocol>` is generic over these.

- Define `LibadukClientToServer` / `LibadukServerToClient` extending goban's types with
  libaduk-local commands (room/join, analysis-_, tv-_, typing).
- Instantiate the client `GameSocket` wrapper with those types so `send()` is typechecked.
- `tsc --noEmit` scoped to the protocol layer (socket.svelte.js, rooms.js,
  server/games/*, goban.js) via a dedicated tsconfig; wire into test/CI.
- This makes protocol fidelity compiler-enforced instead of review-enforced. The
  analysis-mode `send({type:...})` bug would have been a compile error.

### Design resolution (2026-08-02): reviews are the universal container

Question raised: since users are expected to enter analysis on essentially every game,
does every game need a second demo-board/review structure? Considered keeping the
analysis tree embedded on the game document (one shared collaborative tree, format
swapped to MoveTree). Rejected after checking goban's types, for these reasons:

- The review/* wire vocabulary is id-keyed (ReviewMessage carries review_id; event
  names encode it). Speaking the protocol means having review ids regardless of where
  the tree is stored, so "embedded" saves nothing on the wire.
- If uploads are review objects but per-game analysis is an embedded blob, we have two
  representations of "a variation tree" again — the exact disease being cured. One
  container for uploads, kifu, scratch, AND per-game analysis is the unification.
- "One shared tree per game" is policy, not schema: enforce exactly one review per game
  (upsert on first review/connect), auto-connect from the play page. Seamless for the
  "analysis on every game" flow; the model still permits multiple reviews later.
- ReviewMessage's `om` (official move) field is OGS's mechanism for reviews of live
  games tracking the real game underneath — replacing the hand-rolled
  flushPendingAnalysisTree deferral in the play page.
- Trust hierarchy: forking OGS's storage model based on local reasoning is the pattern
  that produced this session's bugs.

Migration: game docs with analysisTree get a review doc created from the blob (colors
re-derived by alternation — no worse than today; already-corrupted uploads like ufwgjh
are corrected by hand via kifu page). analysisTree/analysisActive fields then dropped.

### 2. Uploaded/kifu/scratch content stops being "games" → demo boards / reviews

An uploaded SGF crammed into gamedata inherits the strict-alternation invariant that only
holds for server-refereed live games — that category error _is_ the ufwgjh color-flip bug.
OGS's model: arbitrary SGF content is a demo board / review, a separate object whose
MoveTree stores `player` per node.

- Introduce a review/demo object type; SGF import creates one; kifu + scratch pages
  operate on one.
- HEN import (#68) becomes "set up a position on a demo board."
- Deletes the fake-gamedata path in routes/api/game/upload.

### 3. Analysis mode = OGS review protocol

Current analysis sync (whole-analysisTree blobs + hand-rolled request-control) is a
parallel invention of OGS reviews. GobanBase already has the client surface:
`review_owner_id`, `review_controller_id`, `cur_review_move`, `review.updated` events;
MoveTree is the node structure (stores player per node — fixes color loss structurally).

- Server implements `review/*` vocabulary next to `game/*` in rooms.js/nativeHost style:
  append-style updates, owner/controller model for who's driving.
- Client uses MoveTree + review-following machinery; analysisState.svelte.js's
  serialize/deserialize/alternation logic (~680 lines) goes away.
- One-time migration of stored analysisTree blobs into review objects.
- SPIKE FIRST: how much game/review-following glue is importable from the engine-only
  package vs needs a thin port. Test: build a MoveTree standalone from an SGF-like move
  list. MoveTree's constructor takes a GobanEngine — check coupling.

Concrete evidence for this move, found 2026-08-02 while testing move 3: an OGS import
(game w9bpih, ogsGameId 88820456) with genuine dual-color initial_state loses its white
stones entirely, both on the live board and in analysis. Root cause: GameState.svelte.js
and the play page's enterAnalysisFromMoves both did `parseSgfCoords(initial_state?.black
?? '')` — hand-parsing only half of OGS's real `{black, white}` initial_state shape.
Pre-existing (confirmed via git log, predates this session), not introduced by the
review work.

Initially left as-is on the theory that a one-off patch would just be another
hand-rolled special case pending move 4's real fix (letting GobanEngine's own
constructor interpret initial_state). Revisited after inspecting the actual data:
w9bpih's initial_state has ~80 stones _per color_ with handicap:0 — not a standard
handicap, almost certainly OGS's "continue from a custom/forked position" feature. That
scale makes it a real, visible break worth an interim fix now rather than waiting on
move 4, consistent with existing project guidance (see [[project-ogs-shape-migration]]:
"for display bugs that cross the native/OGS boundary, a display-layer formatter is the
acceptable short-term fix"). Fixed in both call sites: GameState.svelte.js now builds
stoneSetup from both blackCoords and whiteCoords with signs 1/-1; AnalysisState.loadMoves
signature changed from `(moves, handicapStones)` (black-only, hasHandicap-inferred
initial sign) to `(moves, stoneSetup, initialSign)` — caller passes pre-signed stones and
the real `gamedata.initial_player`-derived sign, removing the "handicap implies white
first" heuristic entirely rather than special-casing dual-color on top of it. Verified
with a standalone script: mixed black/white stoneSetup with initialSign=-1 loads with
correct signs at both colors' vertices and correct next-to-play. Typecheck green.
w9bpih itself should now render correctly — worth a manual reload to confirm.

### 4. Client runtime = GobanEngine fed by socket events

Play page holds an engine built from gamedata, applies game/:id/move|clock|phase|
removed_stones events to it, renders from engine state.

- Deletes GameState.svelte.js readers and the sabaki board for live games.
- Deletes hand-rolled winner/result readers — the code behind issues #16, #24, #73.
- Score/estimation: engine.computeScore, ScoreEstimator, autoscore, goban's ownership
  estimators replace @sabaki/influence + $lib/game/board scoring.

## Feature outlook under this architecture

1. **Alt time controls**: JGOF already defines canadian + absolute that libaduk doesn't
   implement — mostly "finish implementing the spec" in clock.js + UI. Novel systems:
   upstream to goban (Seth is an OGS contributor).
2. **Alt scoring rulesets**: goban scores all six (chinese/aga/japanese/korean/ing/nz);
   libaduk hardcodes 'chinese' in builders + migrate script. Plumb the field through.
3. **Arbitrary OGS games**: client is literally OGS's client runtime; undo/conditional
   moves/pause arrive as protocol handling. Remaining work is REST (challenges, lists,
   #38 correspondence attach) over the ogsProxy relay.
4. **KGS via shinkgs API**: one server-side translation layer (kgsProxy.js: KGS JSON API
   ↔ OGS vocabulary), zero client changes. KGS teaching/review maps onto review/*.

## Issues resolved structurally

#16, #24, #73 (hand-rolled OGS result/ownership readers), #27 (GobanSocket reconnect +
port tv off legacy frames), #38 (proxy + attach), #68 (HEN on demo boards), #83/#84/#86
sit on the review model. NOT touched: #76 chat, #77 passkey, #70 devops, #6 ranks —
product work, orthogonal.

## Honest costs / limits

- nativeHost.js + clock.js (~330 lines) stay hand-rolled — no open-source OGS server
  exists. They become the only hand-rolled game logic, typechecked against the protocol.
- Legacy `{type:...}` frames still used by tv-* and lobby ping (handleLegacyMessage in
  rooms.js) — port these to (command, data) framing to close the dual-dialect bug class.
- Rank formatting: goban-engine may not export rank utils; the small guarded formatter in
  ogsSeekGraph.svelte.js stays.

## Progress log

- 2026-08-02: Plan written. Session fixes already applied on this branch: formatOgsRank
  null guard (ogsSeekGraph.svelte.js), AI auto-accept removal for other color (rooms.js),
  five gameSocket.send call sites converted to (command, data) form (play page).
  Migration script validated against prod dump (2203/2203 docs migrated clean locally).
- 2026-08-02: Move 1 shipped. `src/lib/protocol.d.ts` defines LibadukClientToServer /
  LibadukServerToClient built from goban's protocol types via WithStringGameId (string
  game ids are the single sanctioned deviation, documented there). socket.svelte.js is
  fully typed (send/on generic over the protocol; the lenient `data = {}` default that
  enabled the silent analysis bug is removed). Play page has `// @ts-check` and is
  checked by svelte-check. `npm run typecheck` = scripts/typecheck.sh (scoped tsc via
  tsconfig.typecheck.json + svelte-check filtered), wired into `npm test`. Verified the
  harness catches both bug classes: `send({type:...})` → arity error; missing payload
  field → type error. Client payloads raised to full OGS shape: game/chat now sends
  game_id + type:'main'; removed_stones/accept now sends strict_seki_mode:false.
  Findings fixed along the way: bitwise `&` instead of `&&` in play page analysisMode
  conditional; chat handler union narrowed with `'line' in`.
- KNOWN DEBT: svelte-check surfaces ~24 pre-existing prop-drift errors in
  *.stories.svelte (GoBoard vertexSize, nav onCreateGame/onOpenSetup, etc.) —
  filtered out in scripts/typecheck.sh until the stories are updated; unfiltering is
  the follow-up. rooms.js / nativeHost.js / ogsProxy.js not yet under checkJs — add
  them to tsconfig.typecheck.json include as they get annotated (ogsProxy should be
  nearly free since it speaks real OGS types).
- 2026-08-02: MoveTree spike PASSED (standalone node script against goban-engine, since
  deleted). Findings: GobanEngine works standalone; place() creates non-trunk analysis
  moves and showPrevious+place creates branches; editPlace(x, y, color) records
  out-of-order stones with explicit color (edited=true); the move-string format encodes
  edits with color ("ccee!1aa!1ba" = two moves then two consecutive black edits);
  decodeMoves parses it back ({x, y, edited, color}); followPath replays into a fresh
  engine with colors intact. CRITICAL: MoveTree.toJson() is LOSSY (no player/edited
  fields) — review persistence must be the ReviewMessage append log / move strings via
  getMoveStringToThisPoint + followPath, never toJson. The ufwgjh-class weird SGF is
  fully representable: non-alternating moves import as edited placements.
- 2026-08-02: review/* server foundation shipped and verified live. New: reviews
  collection (db.js: getReview/createReview/appendReviewEntry), src/lib/server/reviews.js
  (connect upserts — review id = game id for game reviews, gameId null for standalone;
  race-safe via duplicate-key catch; append strips review_id and stamps ts per OGS
  convention), rooms.js routes review/connect|append|disconnect with per-socket
  subscription tracking (reviewClients map, cleaned up on socket close), emits
  review/{id}/full_state on connect and relays review/{id}/r to others. protocol.d.ts
  gains the review vocabulary (LibadukReviewMessage = OGS ReviewMessage with string
  review_id). Verified with a three-client GobanSocket script against the dev server:
  connect→empty full_state, append relayed live to second client with review_id
  stripped + ts stamped, late joiner receives full log replay. Typecheck green.
- 2026-08-02: Root-caused and fixed the ufwgjh-class color bug directly in
  analysisState.svelte.js, ahead of the full review/MoveTree swap (fix is valid either
  way — same principle review/append entries will need). Root cause precisely: the SGF
  importer (import/+page.svelte, scratch/+page.svelte buildNode) already reads each
  move's real color via sgfNodeToMove — move.sign — and uses it correctly for
  board.makeMove, but only ever passed the _derived next-to-play_ value into
  makeAnalysisNode; move.sign itself was discarded before serialization. Fix:
  makeAnalysisNode gained an explicit `sign` param (the color of this node's own
  move/pass, decoupled from signToPlay which remains "whose turn is next");
  serializeNode now persists it; deserializeFlat/deserializeNodeNested now anchor each
  node's color to its own stored entry.sign (falling back to inherited alternation only
  when absent, for old un-migrated blobs) instead of always re-deriving via alternation
  from the parent. Verified via vite-node script: black/white/black/black (non-
  alternating, same shape as ufwgjh) survives a full serialize→deserialize round trip
  with colors intact — this was the exact case that silently flipped before the fix.
  Typecheck green. NOTE: ufwgjh's own stored blob predates this fix and is still
  corrupted (needs the one-time blob migration, or manual re-fix via kifu page, to
  benefit — the fix only prevents the corruption from being written/reintroduced going
  forward and fixes any _new_ import).
- 2026-08-02: Move 3's core sync landed — analysis mode now runs on the review/*
  protocol end to end, verified against the live dev server. Design fork encountered
  and resolved: OGS's real ReviewMessage is addressed by move-string (f/m), not node
  UUIDs, so "wire analysis onto review/append" and "keep AnalysisState's UUID-tree
  internals" turned out to be separable, not in conflict — no MoveTree/BoardState swap
  needed, GameGraph and MemorizeState untouched. New src/lib/game/reviewCodec.js
  (encodeNodePath/decodeMovePath) bridges AnalysisState's node shape to OGS's real
  encodeMoves/decodeMoves. IMPORTANT gotcha the spike didn't catch: encodeMoves/
  decodeMoves only preserve color through the `edited`/`!` marker — a plain
  (non-edited) run assumes a fixed default first-mover unrelated to our actual
  initial_player, so trusting alternation there would silently reintroduce the exact
  color-loss bug. Fix: every hop is encoded with edited:true, sacrificing string
  compactness for correctness (verified: a black/white/black/black + pass sequence
  round-trips exactly; the naive alternating-encode version silently corrupted 3 of 5
  moves in the same test). analysisState.svelte.js gained applyMovePath (dedup-aware
  tree builder from a decoded path) and AnalysisState.encodeCurrentPath/
  applyReviewEntry (t → comment, bookmark → additive field). protocol.d.ts:
  LibadukReviewMessage extends real ReviewMessage plus one additive `bookmark` field
  (no OGS equivalent exists for it). Play page: enterAnalysis/exitAnalysis/
  persistAnalysisTree/resetAnalysis rewritten; review/connect now fires unconditionally
  at game mount (not gated behind an explicit click) so a fresh joiner's
  review/{id}/full_state can auto-enter analysis if the review already has content —
  preserves "everyone sees the same thing." request-control/clear-control were left
  entirely alone — independent of tree sync, already correct from this session's
  earlier command/data fix. Verified end-to-end with a scripted two-client run against
  the live dev server (not Playwright — see below): client A built the exact
  ufwgjh-shaped non-alternating sequence plus a comment and bookmark, sent one
  review/append; client B, a fresh late-joining AnalysisState, connected and received
  it via full_state with colors/comment/bookmark all intact.
- VERIFICATION NOTE: user does not trust either `npm run test:unit` or Playwright e2e
  in this repo as signal (declined both when offered). The existing e2e suite in
  tests/e2e/gameplay.spec.js has an "analysis" test block that looks like an exact fit
  for this change and was NOT run to validate it — verification here is the scripted
  two-client script above plus the user's own manual testing. If picking this back up,
  don't reach for that e2e suite as proof of correctness.
- DEFERRED / KNOWN GAPS (explicit, not silently dropped):
  - Marker (stone-status `k` field) sync — not wired. Markers stay local-only for now.
  - resetAnalysis is now local-only: the review log is append-only, so "reset" clears
    this client's view but a later full_state refetch (fresh page load, another
    client) can still surface branches recorded before the reset. Real erase would
    need a tombstone concept OGS's protocol doesn't have either.
  - SGF importers (import/+page.svelte, scratch/+page.svelte) build a local tree and
    POST to /api/game/upload as before — they do NOT yet also emit review/append
    entries, so an uploaded SGF's analysisTree still only exists in the old embedded
    field, not as a review doc. This is most of remaining move 2.
  - rooms.js still carries the old analysis-enter/exit/tree handlers and the
    game.analysisActive/analysisTree join-time push (rooms.js ~314-318, ~397-424) —
    dead code now that the client doesn't send those commands, not yet deleted.
  - The analysisTree blob → review doc migration (fixes already-corrupted docs like
    ufwgjh) has not been run. ufwgjh itself is still corrupted at rest.
  - Found via manual testing (not a regression, pre-existing, logged above at move 4):
    initial_state.white is silently dropped by GameState.svelte.js and
    enterAnalysisFromMoves — deliberately left for move 4 rather than patched.
- 2026-08-02: Loose ends closed. src/lib/game/reviewCodec.js gained
  collectReviewEntries(root) (walks a tree, one entry per non-root node with its own
  path/comment/bookmark — reused by both importers and the migration script). import/
  and scratch/+page.svelte now POST reviewEntries instead of analysisTree;
  /api/game/upload writes them via reviews.js (connectReview + appendReviewEntry) and
  no longer touches the analysisTree/analysisActive fields at all. scratch page's
  resume-editing read path (no live socket there) now hits GET /api/game/[gameId],
  which was extended to also return `reviewEntries` from the reviews collection.
  rooms.js: deleted the dead analysis-enter/exit/tree command handlers and the
  join-time `game.analysisActive && game.analysisTree` push (~35 lines) — nothing
  sends those commands anymore. request-control/clear-control untouched, still correct.
  scripts/migrate-analysis-to-reviews.js: one-time migration, deserializes each game's
  old analysisTree blob, walks it via collectReviewEntries, writes a review doc,
  $unsets the three old fields. Run against local dev db: 314/314 migrated cleanly,
  typecheck green throughout.
  CORRECTION, found immediately after running it: the migration does NOT retroactively
  fix already-corrupted trees like ufwgjh. The old analysisTree blob never had a `sign`
  field (that field didn't exist before this session), so deserializeTree falls back to
  the same alternation-based inference that produced the original bug — it faithfully
  carries forward whatever the old (wrong) colors were, now baked permanently into the
  new review doc's stored `sign` values instead of being a transient render-time
  artifact. Confirmed for ufwgjh specifically: first migrated entry decodes as white
  playing first, still not recoverably "true" — the real per-move colors were lost at
  original import time, before any of this session's code existed, and no migration
  can recover data that was never stored. ufwgjh (and any other game with this
  symptom) still needs the user's manual kifu-page correction; the migration's actual
  win is that this can never happen again for anything imported from here on.
- Move 3 + its loose ends are now fully closed. Remaining work per this doc: move 2
  (uploads as demo boards, distinct from "review of a game") is largely subsumed by
  the reviewEntries work above for the analysis-tree half, but the "stop treating
  uploads as fake games" reclassification itself hasn't been done. Move 4 (client
  GobanEngine runtime) not started — see the shiftMap spike note above before starting.
