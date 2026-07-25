import { encodeMove } from '../../goban.js';
import { handicapPoints } from '../../game/board/helpers.js';

export const BLACK_ID = 1;
export const WHITE_ID = 2;

export function idForColor(color) {
  return color === 'black' ? BLACK_ID : WHITE_ID;
}

export function colorForId(playerId) {
  return playerId === BLACK_ID ? 'black' : 'white';
}

export function toJgofTimeControl(tc) {
  if (!tc || tc.type === 'none') {
    return { system: 'none', speed: 'live', pause_on_weekends: false };
  }
  if (tc.type === 'byoyomi') {
    return {
      system: 'byoyomi',
      speed: 'live',
      main_time: tc.initial ?? 0,
      period_time: tc.periodTime ?? 30,
      periods: tc.periods ?? 5,
      pause_on_weekends: false
    };
  }
  if (tc.type === 'fischer') {
    return {
      system: 'fischer',
      speed: 'live',
      initial_time: tc.initial ?? 0,
      time_increment: tc.increment ?? 0,
      max_time: tc.max ?? (tc.initial ?? 0) * 10,
      pause_on_weekends: false
    };
  }
  if (tc.type === 'correspondence') {
    return {
      system: 'simple',
      speed: 'correspondence',
      per_move: (tc.days ?? 3) * 24 * 60 * 60,
      pause_on_weekends: false
    };
  }
  return { system: 'none', speed: 'live', pause_on_weekends: false };
}

export function packMoves(moveEntries) {
  return moveEntries.map((entry) => (entry.type === 'pass' ? [-1, -1] : [entry.x, entry.y]));
}

export function newNativeGamedata({
  id,
  size,
  komi,
  handicap,
  timeControl,
  blackName,
  whiteName,
  handicapStones = null,
  moves = [],
  phase = 'play'
}) {
  handicapStones = handicapStones ?? handicapPoints(size, handicap ?? 0);
  const initialBlack = handicapStones.map(({ x, y }) => encodeMove(x, y)).join('');
  const hasHandicap = handicapStones.length > 0;

  return {
    game_id: id,
    width: size,
    height: size,
    rules: 'chinese',
    komi: komi ?? 6.5,
    handicap: handicap ?? 0,
    free_handicap_placement: false,
    initial_state: { black: initialBlack, white: '' },
    initial_player: hasHandicap ? 'white' : 'black',
    players: {
      black: { id: BLACK_ID, username: blackName },
      white: { id: WHITE_ID, username: whiteName }
    },
    moves,
    phase,
    time_control: toJgofTimeControl(timeControl),
    removed: '',
    clock: null,
    start_time: Math.round(Date.now() / 1000)
  };
}
