export function initialPlayerTime(timeControl) {
  if (timeControl.system === 'byoyomi') {
    return {
      thinking_time: timeControl.main_time,
      periods: timeControl.periods,
      period_time: timeControl.period_time
    };
  }
  if (timeControl.system === 'fischer') {
    return { thinking_time: timeControl.initial_time, skip_bonus: false };
  }
  if (timeControl.system === 'simple') {
    return timeControl.per_move;
  }
  return null;
}

export function consumeElapsed(timeControl, playerTime, elapsedSeconds) {
  if (timeControl.system === 'byoyomi') {
    const clock = { ...playerTime };
    let remaining = elapsedSeconds;
    if (clock.thinking_time > 0) {
      const fromMain = Math.min(clock.thinking_time, remaining);
      clock.thinking_time -= fromMain;
      remaining -= fromMain;
    }
    while (remaining > 0 && clock.periods > 0) {
      if (remaining < clock.period_time) {
        return clock;
      }
      remaining -= clock.period_time;
      clock.periods -= 1;
    }
    if (remaining > 0) return null;
    return clock;
  }
  if (timeControl.system === 'fischer') {
    const afterElapsed = playerTime.thinking_time - elapsedSeconds;
    if (afterElapsed < 0) return null;
    const afterBonus = Math.min(afterElapsed + timeControl.time_increment, timeControl.max_time);
    return { thinking_time: afterBonus, skip_bonus: false };
  }
  if (timeControl.system === 'simple') {
    if (elapsedSeconds > playerTime) return null;
    return timeControl.per_move;
  }
  return null;
}

function remainingSeconds(timeControl, playerTime) {
  if (timeControl.system === 'byoyomi') {
    return playerTime.thinking_time + playerTime.periods * playerTime.period_time;
  }
  if (timeControl.system === 'fischer') {
    return playerTime.thinking_time;
  }
  if (timeControl.system === 'simple') {
    return playerTime;
  }
  return 0;
}

export function buildClock(gamedata, currentPlayerId, blackTime, whiteTime, lastMoveMs) {
  const timeControl = gamedata.time_control;
  const currentTime = currentPlayerId === gamedata.players.black.id ? blackTime : whiteTime;
  const now = Date.now();
  return {
    game_id: gamedata.game_id,
    title: '',
    current_player: currentPlayerId,
    black_player_id: gamedata.players.black.id,
    white_player_id: gamedata.players.white.id,
    last_move: lastMoveMs,
    expiration: lastMoveMs + remainingSeconds(timeControl, currentTime) * 1000,
    now,
    black_time: blackTime,
    white_time: whiteTime
  };
}
