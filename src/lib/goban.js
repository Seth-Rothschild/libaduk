// @ts-check
import * as gobanModule from 'goban-engine';

const goban = /** @type {typeof gobanModule} */ (
  /** @type {any} */ (gobanModule).default ?? gobanModule
);

export const GobanEngine = goban.GobanEngine;
export const GobanSocket = goban.GobanSocket;
export const encodeMove = goban.encodeMove;
export const encodeMoves = goban.encodeMoves;
export const decodeMoves = goban.decodeMoves;
