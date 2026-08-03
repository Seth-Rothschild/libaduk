import type { protocol, GobanEngineConfig, ReviewMessage } from 'goban-engine';

type OgsClientToServer = protocol.ClientToServer;
type OgsServerToClient = protocol.ServerToClient;

type DataArgument<Entry> = Entry extends (data: infer D) => unknown ? D : never;

/**
 * libaduk uses string game ids (Mongo ids) where OGS uses numbers.
 * This is the single sanctioned deviation from the OGS wire protocol.
 * Every other command payload must match goban's ClientToServer shape
 * exactly — reference the OGS type through WithStringGameId rather than
 * writing payload shapes by hand, so drift from OGS is a type error here.
 */
type WithStringGameId<Fn> = Fn extends (data: infer D) => infer R
  ? (data: Omit<D, 'game_id'> & { game_id: string }) => R
  : never;

export interface AnalysisSetupStone {
  x: number;
  y: number;
  sign: number;
}

export interface AnalysisTreeEntry {
  id: string;
  move?: [number, number];
  pass?: boolean;
  parent?: number;
  setup?: AnalysisSetupStone[];
  comment?: string;
  bookmark?: string;
  markers?: unknown[][];
}

/**
 * bookmark has no OGS review equivalent — it's a libaduk-only concept
 * (a named position for quick recall), added additively rather than
 * smuggled through an existing OGS field.
 */
export type LibadukReviewMessage = Omit<ReviewMessage, 'review_id'> & {
  review_id?: string;
  bookmark?: { name: string; createdBy: string } | null;
};

export interface ChatLine {
  chat_id: string;
  username: string;
  player_id: number;
  body: string;
  date: number | null;
  move_number: number;
  channel: string;
}

export interface LibadukClientToServer extends protocol.ClientToServerBase {
  'room/join': (data: {
    gameId: string;
    color: string | null;
    name: string | null;
    ogsToken: string | null;
  }) => void;
  'room/force-resign': (data: { game_id: string }) => void;
  typing: (data: { isTyping: boolean }) => void;

  'game/move': WithStringGameId<OgsClientToServer['game/move']>;
  'game/resign': WithStringGameId<OgsClientToServer['game/resign']>;
  'game/cancel': WithStringGameId<OgsClientToServer['game/cancel']>;
  'game/timed_out': WithStringGameId<OgsClientToServer['game/timed_out']>;
  'game/chat': WithStringGameId<OgsClientToServer['game/chat']>;
  'game/removed_stones/set': WithStringGameId<OgsClientToServer['game/removed_stones/set']>;
  'game/removed_stones/accept': WithStringGameId<OgsClientToServer['game/removed_stones/accept']>;
  'game/removed_stones/reject': WithStringGameId<OgsClientToServer['game/removed_stones/reject']>;

  'review/connect': (data: { review_id: string }) => void;
  'review/disconnect': (data: { review_id: string }) => void;
  'review/append': (data: LibadukReviewMessage) => void;

  'analysis-enter': (data: { tree: AnalysisTreeEntry[]; path: number[] | null }) => void;
  'analysis-exit': (data: Record<string, never>) => void;
  'analysis-tree': (data: { tree: AnalysisTreeEntry[]; path: number[] | null }) => void;
  'request-control': (data: { user: string }) => void;
  'clear-control': (data: Record<string, never>) => void;
}

export interface LibadukServerToClient {
  [k: `review/${string}/full_state`]: (data: LibadukReviewMessage[]) => void;
  [k: `review/${string}/r`]: (data: LibadukReviewMessage) => void;

  [k: `game/${string}/gamedata`]: (data: GobanEngineConfig) => void;
  [k: `game/${string}/move`]: (data: {
    game_id: string;
    move_number: number;
    move: number[];
  }) => void;
  [k: `game/${string}/clock`]: DataArgument<OgsServerToClient['game/:id/clock']> extends infer D
    ? (data: D) => void
    : never;
  [k: `game/${string}/phase`]: OgsServerToClient['game/:id/phase'];
  [k: `game/${string}/chat`]: (data: { channel: string; line: ChatLine } | ChatLine) => void;
  [k: `game/${string}/removed_stones`]: (data: {
    removed: boolean;
    stones: string;
    all_removed: string;
  }) => void;
  [k: `game/${string}/removed_stones_accepted`]: (data: {
    phase: 'finished';
    winner: number;
    outcome: string;
    stones: string;
  }) => void;

  presence: (data: { color: 'black' | 'white' | null; online: boolean }) => void;
  spectators: (data: { names: string[] }) => void;
  typing: (data: { user: string; isTyping: boolean }) => void;
  'analysis-enter': (data: { tree: AnalysisTreeEntry[]; path: number[] | null }) => void;
  'analysis-exit': (data: Record<string, never>) => void;
  'analysis-tree': (data: { tree: AnalysisTreeEntry[]; path: number[] | null }) => void;
  'request-control': (data: { user: string }) => void;
  'clear-control': (data: Record<string, never>) => void;
  'net/pong': (data: { client: number; server: number }) => void;
}

export interface LibadukGameSocketEvents extends LibadukServerToClient {
  connect: () => void;
  disconnect: (code: number) => void;
  reconnect: () => void;
  latency: (latency: number, clock_drift: number) => void;
}
