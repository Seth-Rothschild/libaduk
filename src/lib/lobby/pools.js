export const LIVE_POOLS = [
  {
    clock: '0+3×10s',
    label: 'Bullet',
    size: 9,
    timeControl: { type: 'byoyomi', initial: 0, periods: 3, periodTime: 10 }
  },
  {
    clock: '0+5×10s',
    label: 'Bullet',
    size: 13,
    timeControl: { type: 'byoyomi', initial: 0, periods: 5, periodTime: 10 }
  },
  {
    clock: '1+5×10s',
    label: 'Bullet',
    size: 19,
    timeControl: { type: 'byoyomi', initial: 60, periods: 5, periodTime: 10 }
  },
  {
    clock: '0+3×20s',
    label: 'Blitz',
    size: 9,
    timeControl: { type: 'byoyomi', initial: 0, periods: 3, periodTime: 20 }
  },
  {
    clock: '10+0',
    label: 'Blitz',
    size: 13,
    timeControl: { type: 'byoyomi', initial: 600, periods: 0, periodTime: 0 }
  },
  {
    clock: '0+5×20s',
    label: 'Blitz',
    size: 19,
    timeControl: { type: 'byoyomi', initial: 0, periods: 5, periodTime: 20 }
  },
  {
    clock: '20+0',
    label: 'Blitz',
    size: 19,
    timeControl: { type: 'byoyomi', initial: 1200, periods: 0, periodTime: 0 }
  },
  {
    clock: '5+0',
    label: 'Rapid',
    size: 9,
    timeControl: { type: 'byoyomi', initial: 300, periods: 0, periodTime: 0 }
  },
  {
    clock: '0+5×20s',
    label: 'Rapid',
    size: 13,
    timeControl: { type: 'byoyomi', initial: 0, periods: 5, periodTime: 20 }
  },
  {
    clock: '10+5×20s',
    label: 'Rapid',
    size: 19,
    timeControl: { type: 'byoyomi', initial: 600, periods: 5, periodTime: 20 }
  },
  {
    clock: '20+3×30s',
    label: 'Standard',
    size: 19,
    timeControl: { type: 'byoyomi', initial: 1200, periods: 3, periodTime: 30 }
  }
];
