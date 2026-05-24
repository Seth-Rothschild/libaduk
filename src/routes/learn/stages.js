export const categories = [
  { id: 'rules', title: 'Rules of Go' },
  { id: 'fundamentals', title: 'Fundamentals' },
  { id: 'intermediate', title: 'Intermediate' },
  { id: 'etiquette', title: 'Etiquette' },
  {
    id: 'what_next',
    title: 'What next?',
    static: true,
    description:
      'You know how to play Go, congratulations! Do you want to become a stronger player?'
  }
];

export const stages = [
  {
    id: 'territory',
    category: 'rules',
    title: 'Territory',
    subtitle: 'How you get points',
    description:
      'The goal of the game is to surround the most empty space. Ready to finish your first game?',
    image: '/images/learn/abacus.svg',
    lessons: [
      {
        id: 'territory-1',
        description: 'Place black stones to finish the game',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      },
      {
        id: 'territory-2',
        description: 'Place black stones to finish the game',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      },
      {
        id: 'territory-3',
        description: 'Place black stones to finish the game',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'capturing',
    category: 'rules',
    title: 'Capturing',
    subtitle: 'Taking the enemy pieces',
    description: '',
    image: '/images/learn/fishing-net.svg',
    lessons: [
      {
        id: 'capturing-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'passing',
    category: 'rules',
    title: 'Passing',
    subtitle: 'Ending the game',
    description: '',
    image: '/images/learn/shaking-hands.svg',
    lessons: [
      {
        id: 'passing-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'ko',
    category: 'rules',
    title: 'Ko',
    subtitle: 'Capture and recapture',
    description: '',
    image: '/images/learn/time-trap.svg',
    lessons: [
      {
        id: 'ko-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'board-setup',
    category: 'rules',
    title: 'Board setup',
    subtitle: 'Keeping the game fair',
    description: '',
    image: '/images/learn/scales.svg',
    lessons: [
      {
        id: 'board-setup-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'big-moves',
    category: 'fundamentals',
    title: 'Big moves',
    subtitle: 'Choosing where to play',
    description: '',
    image: '/images/learn/globe.svg',
    lessons: [
      {
        id: 'big-moves-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'attack',
    category: 'fundamentals',
    title: 'Attack',
    subtitle: 'Threatening to capture',
    description: '',
    image: '/images/learn/bowman.svg',
    lessons: [
      {
        id: 'attack-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'defense',
    category: 'fundamentals',
    title: 'Defense',
    subtitle: 'Preventing capture',
    description: '',
    image: '/images/learn/bolt-shield.svg',
    lessons: [
      {
        id: 'defense-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'reading',
    category: 'fundamentals',
    title: 'Reading',
    subtitle: 'Predicting the future',
    description: '',
    image: '/images/learn/crystal-ball.svg',
    lessons: [
      {
        id: 'reading-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'sente',
    category: 'intermediate',
    title: 'Sente',
    subtitle: 'Keeping the initiative',
    description: '',
    image: '/images/learn/sprint.svg',
    lessons: [
      {
        id: 'sente-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'tesuji',
    category: 'intermediate',
    title: 'Tesuji',
    subtitle: 'Tricks for capturing stones',
    description: '',
    image: '/images/learn/magic-hat.svg',
    lessons: [
      {
        id: 'tesuji-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'joseki',
    category: 'intermediate',
    title: 'Joseki',
    subtitle: 'Learning opening patterns',
    description: '',
    image: '/images/learn/tied-scroll.svg',
    lessons: [
      {
        id: 'joseki-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'continuing-play',
    category: 'etiquette',
    title: 'Continuing play',
    subtitle: 'Respecting your opponent',
    description: '',
    image: '/images/learn/spade.svg',
    lessons: [
      {
        id: 'continuing-play-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'review-culture',
    category: 'etiquette',
    title: 'Review culture',
    subtitle: 'Learning with your opponent',
    description: '',
    image: '/images/learn/teacher.svg',
    lessons: [
      {
        id: 'review-culture-1',
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: [],
        successText: '',
        failureText: ''
      }
    ]
  },
  {
    id: 'register',
    category: 'what_next',
    title: 'Register',
    subtitle: 'Get a free Libaduk account',
    image: '/images/learn/id-card.svg',
    href: '/signup'
  },
  {
    id: 'play-people',
    category: 'what_next',
    title: 'Find people to play with',
    subtitle: 'Opponents from around the world',
    image: '/images/learn/sword-clash.svg',
    href: '/tv'
  },
  {
    id: 'play-machine',
    category: 'what_next',
    title: 'Play machine',
    subtitle: 'Test your skills with the computer',
    image: '/images/learn/robot-golem.svg',
    href: '#'
  },
  {
    id: 'puzzles',
    category: 'what_next',
    title: 'Puzzles',
    subtitle: 'Exercise your tactical skills',
    image: '/images/learn/bullseye.svg',
    href: '/puzzle'
  }
];
