export const LIVE_POOLS = [
  {
    clock: '0+3×10s',
    label: 'Bullet',
    size: 9,
    timeControl: { type: 'byoyomi', initial: 0, periods: 3, periodTime: 10 }
  },
  {
    clock: '1+3×20s',
    label: 'Bullet',
    size: 19,
    timeControl: { type: 'byoyomi', initial: 60, periods: 3, periodTime: 20 }
  },
  {
    clock: '20+0',
    label: 'Blitz',
    size: 19,
    timeControl: { type: 'fischer', initial: 1200, increment: 0 }
  },
  {
    clock: '0+3×20s',
    label: 'Blitz',
    size: 9,
    timeControl: { type: 'byoyomi', initial: 0, periods: 3, periodTime: 20 }
  },
  {
    clock: '5+0',
    label: 'Rapid',
    size: 9,
    timeControl: { type: 'fischer', initial: 300, increment: 0 }
  },
  {
    clock: '10+3×20s',
    label: 'Rapid',
    size: 19,
    timeControl: { type: 'byoyomi', initial: 600, periods: 3, periodTime: 20 }
  },
  {
    clock: '10+0',
    label: 'Standard',
    size: 9,
    timeControl: { type: 'fischer', initial: 600, increment: 0 }
  },
  {
    clock: '20+3×30s',
    label: 'Standard',
    size: 19,
    timeControl: { type: 'byoyomi', initial: 1200, periods: 3, periodTime: 30 }
  },
  {
    clock: '45+3×30s',
    label: 'Classical',
    size: 19,
    timeControl: { type: 'byoyomi', initial: 2700, periods: 3, periodTime: 30 }
  },
  {
    clock: '1 day',
    label: 'Correspondence',
    size: 19,
    timeControl: { type: 'correspondence', days: 1 }
  },
  {
    clock: '3 days',
    label: 'Correspondence',
    size: 19,
    timeControl: { type: 'correspondence', days: 3 }
  }
];
