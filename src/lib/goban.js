import * as gobanModule from 'goban-engine';

const goban = gobanModule.default ?? gobanModule;

export const GobanEngine = goban.GobanEngine;
export const GobanSocket = goban.GobanSocket;
export const encodeMove = goban.encodeMove;
export const encodeMoves = goban.encodeMoves;
export const decodeMoves = goban.decodeMoves;
