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
      'The goal of the game is to surround the most empty space. Follow the hints to finish your first few games!',
    image: '/images/learn/abacus.svg',
    lessons: [
      {
        description: 'Black has no points until the wall is finished. Finish it!',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [3, 5],
            [4, 5],
            [5, 5],
            [6, 5],
            [3, 6],
            [3, 7],
            [3, 8]
          ],
          white: [
            [0, 1],
            [1, 1],
            [2, 1],
            [2, 2],
            [2, 3],
            [2, 4],
            [2, 5]
          ]
        },
        turn: 'black',
        solution: [
          [7, 5],
          [1, 5],
          [8, 5],
          [0, 5]
        ],
        hints: { 0: [7, 5], 2: [8, 5] }
      },
      {
        description: 'Finish the wall to win the game for Black',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [0, 4],
            [1, 4],
            [2, 4],
            [3, 4],
            [4, 4],
            [5, 4],
            [6, 4],
            [2, 6],
            [6, 6]
          ],
          white: [
            [2, 1],
            [6, 1],
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3],
            [4, 3],
            [5, 3],
            [6, 3]
          ]
        },
        turn: 'black',
        solution: [
          [7, 4],
          [7, 3],
          [8, 4],
          [8, 3]
        ],
        hints: { 0: [7, 4], 2: [8, 4] }
      },
      {
        description: 'Extend your territory by capturing some stones.',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [6, 6],
            [2, 6],
            [0, 2],
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3],
            [4, 3],
            [5, 3],
            [6, 3],
            [7, 4],
            [8, 4]
          ],
          white: [
            [0, 1],
            [1, 1],
            [1, 2],
            [2, 2],
            [3, 2],
            [4, 2],
            [5, 2],
            [6, 2],
            [7, 3],
            [8, 3]
          ]
        },
        turn: 'black',
        solution: [
          [7, 2],
          [7, 1],
          [8, 2],
          [8, 1]
        ],
        hints: { 0: [7, 2], 2: [8, 2] }
      },
      {
        description: 'White is going to capture these stones, but Black has more territory!',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [6, 2],
            [7, 2],
            [8, 2],
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3],
            [4, 3],
            [5, 4]
          ],
          white: [
            [6, 1],
            [7, 1],
            [8, 1],
            [0, 2],
            [1, 2],
            [2, 2],
            [3, 2],
            [4, 2],
            [5, 2],
            [6, 3]
          ]
        },
        turn: 'black',
        solution: [
          [6, 4],
          [7, 3],
          [7, 4],
          [8, 3],
          [8, 4]
        ],
        hints: { 0: [6, 4], 2: [7, 4], 4: [8, 4] }
      },
      {
        description:
          'White really wants to capture stones. But territory is what wins the game. Take advantage as Black!',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [0, 1],
            [5, 1],
            [7, 1],
            [1, 2],
            [2, 2],
            [5, 2],
            [5, 3],
            [2, 4],
            [3, 4],
            [4, 4],
            [5, 5],
            [2, 6],
            [5, 7]
          ],
          white: [
            [3, 0],
            [1, 1],
            [2, 1],
            [4, 1],
            [4, 2],
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3],
            [4, 3]
          ]
        },
        turn: 'black',
        solution: [
          [1, 4],
          [0, 2],
          [0, 4],
          [3, 2],
          [5, 0],
          [0, 0]
        ],
        hints: { 0: [1, 4], 2: [0, 4], 4: [5, 0] }
      }
    ]
  },
  {
    id: 'capturing',
    category: 'rules',
    title: 'Capturing',
    subtitle: 'Taking the enemy stones',
    description:
      "If you surround an opponent's stone, you can capture it. Follow the instructions to capture stones in these examples.",
    image: '/images/learn/fishing-net.svg',
    lessons: [
      {
        description: 'Surround this stone to capture it!',
        boardSize: 9,
        initialStones: {
          black: [
            [4, 3],
            [3, 4],
            [4, 5]
          ],
          white: [[4, 4]]
        },
        turn: 'black',
        solution: [[5, 4]],
        hints: { 0: [5, 4] }
      },
      {
        description: 'Capture these two White stones.',
        boardSize: 9,
        initialStones: {
          black: [
            [4, 3],
            [5, 3],
            [3, 4],
            [4, 5],
            [5, 5]
          ],
          white: [
            [4, 4],
            [5, 4]
          ]
        },
        turn: 'black',
        solution: [[6, 4]],
        hints: { 0: [6, 4] }
      },
      {
        description: 'Push the stone towards the wall to capture it',
        boardSize: 9,
        initialStones: {
          black: [
            [6, 3],
            [7, 4]
          ],
          white: [[7, 3]]
        },
        turn: 'black',
        solution: [
          [7, 2],
          [8, 3],
          [8, 4],
          [8, 2],
          [8, 1]
        ],
        hints: { 0: [7, 2], 2: [8, 4] }
      },
      {
        description: 'Find the sequence to push this stone into the wall',
        boardSize: 9,
        initialStones: {
          black: [
            [2, 6],
            [1, 7],
            [2, 8],
            [3, 8]
          ],
          white: [
            [2, 7],
            [3, 7]
          ]
        },
        turn: 'black',
        solution: [
          [4, 7],
          [3, 6],
          [3, 5],
          [4, 6],
          [5, 6],
          [4, 5],
          [4, 4],
          [5, 5],
          [6, 5],
          [5, 4],
          [5, 3],
          [6, 4],
          [7, 4],
          [6, 3],
          [6, 2],
          [7, 3],
          [7, 2],
          [8, 3],
          [8, 4],
          [8, 2],
          [8, 1]
        ],
        hints: { 0: [4, 7], 16: [7, 2], 18: [8, 4] }
      },
      {
        description: "You can't play in the center until it would capture all the stones",
        boardSize: 9,
        initialStones: {
          black: [
            [3, 2],
            [5, 2],
            [2, 3],
            [6, 3],
            [2, 4],
            [6, 4],
            [3, 5],
            [6, 5],
            [4, 6],
            [5, 6]
          ],
          white: [
            [3, 3],
            [4, 3],
            [5, 3],
            [3, 4],
            [5, 4],
            [4, 5],
            [5, 5]
          ]
        },
        turn: 'black',
        solution: [
          [4, 2],
          [3, 6],
          [4, 4]
        ],
        hints: { 0: [4, 2] }
      },
      {
        description: 'Capture these stones in the corner!',
        boardSize: 9,
        initialStones: {
          black: [
            [0, 6],
            [1, 6],
            [2, 6],
            [3, 6],
            [3, 7],
            [3, 8]
          ],
          white: [
            [0, 7],
            [1, 7],
            [2, 7],
            [2, 8]
          ]
        },
        turn: 'black',
        solution: [
          [1, 8],
          [0, 8],
          [1, 8]
        ],
        hints: { 0: [1, 8] }
      }
    ]
  },
  {
    id: 'passing',
    category: 'rules',
    title: 'Passing',
    subtitle: 'Ending the game',
    description:
      'When there are no more useful moves, players pass instead of playing a stone. Two passes in a row ends the game.',
    image: '/images/learn/shaking-hands.svg',
    lessons: [
      {
        description: 'When there are no more useful moves, click the pass button',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [0, 4],
            [1, 4],
            [2, 4],
            [3, 4],
            [4, 4],
            [5, 4],
            [6, 4],
            [7, 4],
            [2, 6],
            [7, 6]
          ],
          white: [
            [1, 1],
            [7, 1],
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3],
            [4, 3],
            [5, 3],
            [6, 3],
            [7, 3]
          ]
        },
        turn: 'black',
        solution: [[8, 3], [8, 2], [8, 4], null, null],
        hints: { 0: [8, 3], 2: [8, 4], 4: null }
      },
      {
        description: 'White passes too early here. Take advantage as Black.',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [4, 1],
            [2, 2],
            [4, 2],
            [4, 3],
            [4, 4],
            [4, 5],
            [4, 6],
            [4, 7]
          ],
          white: [
            [5, 0],
            [5, 1],
            [5, 2],
            [5, 3],
            [5, 4],
            [5, 5],
            [5, 6],
            [5, 7],
            [7, 7]
          ]
        },
        turn: 'black',
        solution: [[4, 0], null, [5, 8], [6, 8], [4, 8], null, null],
        hints: { 0: [4, 0], 2: [5, 8], 4: [4, 8], 6: null }
      }
    ]
  },
  {
    id: 'ko',
    category: 'rules',
    title: 'Ko',
    subtitle: 'Capture and recapture',
    description:
      'To prevent infinite loops, players cannot immediately recapture. The rule that the board position cannot repeat is called "Ko".',
    image: '/images/learn/time-trap.svg',
    lessons: [
      {
        description: 'Capture the stone',
        boardSize: 9,
        initialStones: {
          black: [
            [4, 3],
            [3, 4],
            [4, 5]
          ],
          white: [
            [5, 3],
            [4, 4],
            [6, 4],
            [5, 5]
          ]
        },
        turn: 'black',
        solution: [
          [5, 4],
          [4, 2],
          [4, 4]
        ],
        hints: { 0: [5, 4], 2: [4, 4] }
      },
      {
        description: 'Find an urgent move that White must respond to',
        boardSize: 9,
        initialStones: {
          black: [
            [2, 1],
            [4, 1],
            [4, 2],
            [5, 2],
            [2, 3],
            [3, 3],
            [4, 3],
            [2, 4],
            [1, 5],
            [2, 6],
            [4, 6],
            [2, 7]
          ],
          white: [
            [6, 0],
            [5, 1],
            [6, 2],
            [6, 3],
            [3, 4],
            [6, 4],
            [7, 4],
            [4, 5],
            [5, 5],
            [3, 6],
            [3, 7]
          ]
        },
        turn: 'black',
        solution: [
          [3, 5],
          [2, 5],
          [6, 1],
          [7, 1],
          [3, 5]
        ],
        hints: { 0: [3, 5], 2: [6, 1], 4: [3, 5] }
      },
      {
        description:
          "Ko are not always important. But it's mildly better to be the last person to fill it. Sometimes there's nothing you can do.",
        boardSize: 9,
        initialStones: {
          black: [
            [4, 0],
            [4, 1],
            [2, 2],
            [4, 2],
            [1, 3],
            [4, 3],
            [3, 4],
            [3, 5],
            [4, 5],
            [4, 6],
            [2, 7],
            [3, 7],
            [2, 8]
          ],
          white: [
            [5, 0],
            [5, 1],
            [1, 2],
            [5, 2],
            [5, 3],
            [5, 4],
            [5, 5],
            [5, 6],
            [4, 7],
            [5, 7],
            [3, 8],
            [5, 8]
          ]
        },
        turn: 'black',
        solution: [
          [4, 8],
          [2, 3],
          [1, 1],
          [3, 8],
          [4, 4],
          [4, 8]
        ],
        hints: { 0: [4, 8], 2: [1, 1], 4: [4, 4] }
      }
    ]
  },
  {
    id: 'board-setup',
    category: 'rules',
    title: 'Board setup',
    subtitle: 'Keeping the game fair',
    description:
      'Go has two mechanisms for keeping the game fair. The player who plays second gets extra points called Komi. But in games where the players are at different skill, Komi is reduced and Black gets extra stones.',
    image: '/images/learn/scales.svg',
    lessons: [
      {
        description:
          'Black has 9 points of territory, White has 4. But with standard Komi of 6.5 Black loses this game.',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [3, 0],
            [3, 1],
            [3, 2],
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3]
          ],
          white: [
            [6, 6],
            [7, 6],
            [8, 6],
            [6, 7],
            [6, 8]
          ]
        },
        turn: 'black',
        solution: [],
        hints: {}
      },
      {
        description:
          'This is a 4 stone handicap game and Komi is 0.5 points. White plays first and must attack aggressively to have a chance.',
        boardSize: 9,
        initialStones: {
          black: [
            [2, 2],
            [6, 2],
            [2, 6],
            [6, 6]
          ],
          white: []
        },
        turn: 'black',
        solution: [],
        hints: {}
      },
      {
        description: 'Black just barely wins this game even though they have much more than half.',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [5, 2],
            [7, 3],
            [8, 3],
            [0, 4],
            [1, 4],
            [2, 4],
            [3, 4],
            [4, 4],
            [5, 4],
            [6, 4],
            [7, 4]
          ],
          white: [
            [8, 4],
            [0, 5],
            [1, 5],
            [2, 5],
            [3, 5],
            [4, 5],
            [5, 5],
            [6, 5],
            [7, 5],
            [8, 5],
            [7, 7]
          ]
        },
        turn: 'black',
        solution: [],
        hints: {}
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
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: []
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
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: []
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
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: []
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
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: []
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
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: []
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
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: []
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
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: []
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
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: []
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
        description: '',
        boardSize: 9,
        initialStones: { black: [], white: [] },
        turn: 'black',
        goal: '',
        solution: []
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
    title: 'Find people to learn with',
    subtitle: 'Players from around the world',
    image: '/images/learn/chat-bubble.svg',
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
  },
  {
    id: 'ogs-practice',
    category: 'what_next',
    title: 'Practice',
    subtitle: 'Do more lessons on OGS',
    image: '/images/learn/weight-lifting-up.svg',
    href: 'https://online-go.com/learn-to-play-go'
  }
];
