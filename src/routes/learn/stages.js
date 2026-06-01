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
    id: 'intro',
    category: 'rules',
    title: 'What is Go?',
    subtitle: 'The board and stones',
    description:
      'Go is a very old two player game strategy where players take turns placing stones on a board. How hard could it be?',
    endDescription:
      'You now know the basics of Go! Read the text and play the suggested moves to learn from the lessons. Ready to learn how to score points?',
    image: '/images/learn/stone-stack.svg',
    lessons: [
      {
        description:
          "In this tutorial, context on the lesson will be in this window and you'll be following hints marked in blue. While you can complete the lessons without learning anything, we would recommend looking at the context here before each lesson.",
        boardSize: 19,
        initialStones: {
          black: [],
          white: []
        },
        turn: 'black',
        solution: [],
        hints: {}
      },
      {
        description:
          'It\'s estimated about 46 million people know how to play Go, mostly in Asia. It\'s known as "igo" (囲碁) in Japanese, "weiqi" (圍棋) in Chinese and "baduk" (바둑) in Korean.',
        boardSize: 19,
        initialStones: {
          black: [],
          white: []
        },
        turn: 'black',
        solution: [],
        hints: {},
        links: {
          '46 million':
            'https://web.archive.org/web/20170517013354/http://www.intergofed.org/wp-content/uploads/2016/06/2016_Go_population_report.pdf'
        }
      },

      {
        description:
          'Go is an extremely old board game where players take turns placing stones on intersections of a grid on a board. Black goes first. Place a stone on the board at the marked location!',
        boardSize: 19,
        initialStones: {
          black: [],
          white: []
        },
        turn: 'black',
        solution: [[9, 9]],
        hints: { 0: [9, 9] },
        links: { 'extremely old': 'https://en.wikipedia.org/wiki/Go_(game)' }
      },
      {
        description:
          'Go is most often played on 19x19 boards, but 13x13 and 9x9 are also popular. While even fast games on large boards can take half an hour, a 9x9 game can be finished in under 5 minutes. Play a stone on a 13x13 board.',
        boardSize: 13,
        initialStones: {
          black: [],
          white: []
        },
        turn: 'black',
        solution: [[6, 6]],
        hints: { 0: [6, 6] }
      },
      {
        description:
          'Games of Go can be made more fair by letting the weaker player start with extra stones on the board. This lets players of dramatically different skill levels both have a challenging and interesting game!',
        boardSize: 19,
        initialStones: {
          black: [
            [3, 3],
            [9, 3],
            [15, 3],
            [3, 9],
            [9, 9],
            [15, 9],
            [3, 15],
            [9, 15],
            [15, 15]
          ],
          white: []
        },
        turn: 'black',
        solution: [],
        hints: {}
      },
      {
        description:
          'The game concludes when both players agree to stop playing. This will be covered in the Passing lessons but for now it\'s helpful to know there\'s sometimes a "pass" button to look for and click.',
        boardSize: 19,
        initialStones: {
          black: [],
          white: []
        },
        turn: 'black',
        solution: [null],
        hints: { 0: null }
      }
    ]
  },
  {
    id: 'territory',
    category: 'rules',
    title: 'Territory',
    subtitle: 'How you get points',
    description:
      'The goal of the game is to surround the most empty space. Follow the hints to finish your first few games!',
    endDescription:
      "You've finished your first few games and surrounded empty space to score points. Ready to learn more?",
    image: '/images/learn/abacus.svg',
    lessons: [
      {
        description:
          'You score points by surrounding empty space. Play a stone to get some points for black!',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [3, 4],
            [4, 4],
            [6, 4],
            [3, 5],
            [6, 5],
            [3, 6],
            [4, 6],
            [5, 6],
            [6, 6]
          ],
          white: [
            [1, 0],
            [3, 0],
            [1, 1],
            [3, 1],
            [1, 2],
            [3, 2]
          ]
        },
        turn: 'black',
        solution: [
          [5, 4],
          [2, 2]
        ],
        hints: { 0: [5, 4] }
      },
      {
        description: "You don't need to complete corners for the territory to count",
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [4, 4],
            [3, 5],
            [6, 5],
            [4, 6],
            [5, 6]
          ],
          white: [
            [1, 0],
            [3, 0],
            [1, 1],
            [3, 1]
          ]
        },
        turn: 'black',
        solution: [
          [5, 4],
          [2, 2]
        ],
        hints: { 0: [5, 4] }
      },
      {
        description:
          'It takes fewer stones to surround more territory in the corner than in the center.',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [2, 1],
            [3, 1],
            [1, 2],
            [4, 2],
            [1, 3],
            [4, 3],
            [2, 4],
            [2, 6],
            [7, 6],
            [1, 7],
            [4, 7],
            [6, 7],
            [1, 8],
            [4, 8],
            [6, 8]
          ],
          white: [[7, 2]]
        },
        turn: 'black',
        solution: [
          [3, 4],
          [7, 0],
          [3, 6],
          [7, 1],
          [8, 6],
          [8, 2]
        ],
        hints: { 0: [3, 4], 2: [3, 6], 4: [8, 6] }
      },
      {
        description:
          'During the game players create walls which surround territory. But Black has no points until the wall is finished. Finish it!',
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
        description: 'Sometimes, the walls are simple. Finish the game!',
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
        description: 'Sometimes, the walls can become more complex. Finish the game!',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [4, 3],
            [6, 3],
            [1, 4],
            [2, 4],
            [3, 4],
            [4, 4],
            [5, 4],
            [6, 4],
            [0, 5],
            [1, 6]
          ],
          white: [
            [4, 2],
            [5, 2],
            [6, 2],
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3],
            [5, 3],
            [7, 3],
            [7, 4]
          ]
        },
        turn: 'black',
        solution: [
          [7, 5],
          [8, 4],
          [8, 5]
        ],
        hints: { 0: [7, 5], 2: [8, 5] }
      },
      {
        description:
          'Often, there are several bits of territory to complete at the end of the game. Finish the game',
        boardSize: 9,
        showScoring: true,
        initialStones: {
          black: [
            [4, 1],
            [5, 1],
            [5, 2],
            [6, 2],
            [7, 2],
            [2, 3],
            [3, 3],
            [4, 3],
            [7, 3],
            [1, 5],
            [2, 5],
            [4, 5],
            [4, 6],
            [3, 7],
            [3, 8]
          ],
          white: [
            [4, 0],
            [3, 1],
            [2, 2],
            [3, 2],
            [4, 2],
            [1, 3],
            [5, 3],
            [6, 3],
            [1, 4],
            [7, 4],
            [5, 5],
            [5, 6],
            [4, 7],
            [6, 7],
            [4, 8]
          ]
        },
        turn: 'black',
        solution: [
          [5, 0],
          [3, 0],
          [8, 3],
          [8, 4],
          [4, 4],
          [5, 4],
          [2, 4],
          [1, 2],
          [0, 5],
          [0, 4]
        ],
        hints: { 0: [5, 0], 2: [8, 3], 4: [4, 4], 6: [2, 4], 8: [0, 5] }
      }
    ]
  },
  {
    id: 'capturing',
    category: 'rules',
    title: 'Capturing',
    subtitle: 'Taking the enemy stones',
    description:
      "If you surround an opponent's stone, you can capture it and remove it from the board.",

    endDescription:
      "You've learned how to capture stones. You can use capturing to claim and maintain territory. Ready to learn more?",
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
        description:
          'As with territory, it takes fewer stones to capture in the corner than in the center',
        boardSize: 9,
        initialStones: {
          black: [
            [4, 3],
            [3, 4],
            [4, 5],
            [4, 7],
            [3, 8],
            [7, 8]
          ],
          white: [[4, 4]]
        },
        turn: 'black',
        solution: [
          [5, 4],
          [4, 8],
          [5, 8],
          [8, 8],
          [8, 7]
        ],
        hints: { 0: [5, 4], 2: [5, 8], 4: [8, 7] }
      },
      {
        description:
          'When stones are attached to each other, you need to entirely surround all of the sides to capture. Capture these two stones.',
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
        description: 'The white stones are not attached. Capture them!',
        boardSize: 9,
        initialStones: {
          black: [
            [4, 3],
            [5, 3],
            [3, 4],
            [4, 5],
            [5, 6]
          ],
          white: [
            [6, 3],
            [4, 4],
            [5, 4]
          ]
        },
        turn: 'black',
        solution: [
          [6, 4],
          [5, 5],
          [6, 5]
        ],
        hints: { 0: [6, 4], 2: [6, 5] }
      },
      {
        description:
          'Sometimes you cannot escape capture. Push the stone towards the wall to capture it',
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
        hints: { 0: [7, 2], 2: [8, 4], 4: [8, 1] }
      },
      // {
      //   description: 'Find the sequence to push this stone into the wall',
      //   boardSize: 9,
      //   initialStones: {
      //     black: [
      //       [2, 6],
      //       [1, 7],
      //       [2, 8],
      //       [3, 8]
      //     ],
      //     white: [
      //       [2, 7],
      //       [3, 7]
      //     ]
      //   },
      //   turn: 'black',
      //   solution: [
      //     [4, 7],
      //     [3, 6],
      //     [3, 5],
      //     [4, 6],
      //     [5, 6],
      //     [4, 5],
      //     [4, 4],
      //     [5, 5],
      //     [6, 5],
      //     [5, 4],
      //     [5, 3],
      //     [6, 4],
      //     [7, 4],
      //     [6, 3],
      //     [6, 2],
      //     [7, 3],
      //     [7, 2],
      //     [8, 3],
      //     [8, 4],
      //     [8, 2],
      //     [8, 1]
      //   ],
      //   hints: { 0: [4, 7], 16: [7, 2], 18: [8, 4] }
      // },
      {
        description:
          'You cannot play stones that would be completely surrounded, unless they also remove stones from the board. White is not completely surrounded until black plays at the triangles. Capture the big White group!',
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
        hints: { 0: [4, 2], 2: [4, 4] },
        markers: {
          0: [
            { x: 4, y: 4, type: 'triangle' },
            { x: 4, y: 2, type: 'triangle' }
          ]
        }
      },
      {
        description:
          'You can play stones that are mostly surrounded though. Take two moves to capture these stones in the corner!',
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
        hints: { 0: [1, 8], 2: [1, 8] }
      },
      {
        description: 'Capture the White stones. No hint on this one!',
        boardSize: 9,
        initialStones: {
          black: [
            [0, 4],
            [1, 4],
            [2, 4],
            [3, 4],
            [4, 5],
            [5, 5],
            [6, 5],
            [7, 5],
            [8, 5],
            [4, 6],
            [4, 7],
            [5, 7],
            [6, 7],
            [7, 7]
          ],
          white: [
            [0, 5],
            [1, 5],
            [2, 5],
            [3, 5],
            [3, 6],
            [5, 6],
            [6, 6],
            [7, 6],
            [8, 6],
            [3, 7],
            [8, 7],
            [4, 8],
            [5, 8],
            [6, 8],
            [7, 8]
          ]
        },
        turn: 'black',
        solution: [[8, 8]],
        hints: {}
      },
      {
        description: 'Capture the White stones in two moves. No hints here either.',
        boardSize: 9,
        initialStones: {
          black: [
            [3, 6],
            [5, 6],
            [6, 6],
            [7, 6],
            [8, 6],
            [4, 7],
            [3, 8],
            [6, 8],
            [8, 8]
          ],
          white: [
            [5, 7],
            [6, 7],
            [7, 7],
            [8, 7],
            [4, 8]
          ]
        },
        turn: 'black',
        solution: [
          [5, 8],
          [7, 8],
          [8, 8]
        ],
        hints: {}
      },

      {
        description:
          'The point of the game is territory, not capturing. But you use capturing to claim and extend your territory. Extend your territory by capturing some stones.',
        boardSize: 9,
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
        description:
          "There is nothing you can do to save these stones (we'll see them again in the Reading lessons). But remember, the objective is territory!",
        boardSize: 9,
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
  // {
  //   id: 'ko',
  //   category: 'rules',
  //   title: 'Ko',
  //   subtitle: 'Capture and recapture',
  //   description:
  //     'To prevent infinite loops, players cannot immediately recapture. The rule that the board position cannot repeat is called "Ko".',
  //   image: '/images/learn/time-trap.svg',
  //   lessons: [
  //     {
  //       description: 'Capture the stone',
  //       boardSize: 9,
  //       initialStones: {
  //         black: [
  //           [4, 3],
  //           [3, 4],
  //           [4, 5]
  //         ],
  //         white: [
  //           [5, 3],
  //           [4, 4],
  //           [6, 4],
  //           [5, 5]
  //         ]
  //       },
  //       turn: 'black',
  //       solution: [
  //         [5, 4],
  //         [4, 2],
  //         [4, 4]
  //       ],
  //       hints: { 0: [5, 4], 2: [4, 4] }
  //     },
  //     {
  //       description: 'Find an urgent move that White must respond to',
  //       boardSize: 9,
  //       initialStones: {
  //         black: [
  //           [2, 1],
  //           [4, 1],
  //           [4, 2],
  //           [5, 2],
  //           [2, 3],
  //           [3, 3],
  //           [4, 3],
  //           [2, 4],
  //           [1, 5],
  //           [2, 6],
  //           [4, 6],
  //           [2, 7]
  //         ],
  //         white: [
  //           [6, 0],
  //           [5, 1],
  //           [6, 2],
  //           [6, 3],
  //           [3, 4],
  //           [6, 4],
  //           [7, 4],
  //           [4, 5],
  //           [5, 5],
  //           [3, 6],
  //           [3, 7]
  //         ]
  //       },
  //       turn: 'black',
  //       solution: [
  //         [3, 5],
  //         [2, 5],
  //         [6, 1],
  //         [7, 1],
  //         [3, 5]
  //       ],
  //       hints: { 0: [3, 5], 2: [6, 1], 4: [3, 5] }
  //     },
  //     {
  //       description:
  //         "Ko are not always important. But it's mildly better to be the last person to fill it. Sometimes there's nothing you can do.",
  //       boardSize: 9,
  //       initialStones: {
  //         black: [
  //           [4, 0],
  //           [4, 1],
  //           [2, 2],
  //           [4, 2],
  //           [1, 3],
  //           [4, 3],
  //           [3, 4],
  //           [3, 5],
  //           [4, 5],
  //           [4, 6],
  //           [2, 7],
  //           [3, 7],
  //           [2, 8]
  //         ],
  //         white: [
  //           [5, 0],
  //           [5, 1],
  //           [1, 2],
  //           [5, 2],
  //           [5, 3],
  //           [5, 4],
  //           [5, 5],
  //           [5, 6],
  //           [4, 7],
  //           [5, 7],
  //           [3, 8],
  //           [5, 8]
  //         ]
  //       },
  //       turn: 'black',
  //       solution: [
  //         [4, 8],
  //         [2, 3],
  //         [1, 1],
  //         [3, 8],
  //         [4, 4],
  //         [4, 8]
  //       ],
  //       hints: { 0: [4, 8], 2: [1, 1], 4: [4, 4] }
  //     }
  //   ]
  // },
  {
    id: 'attack',
    category: 'fundamentals',
    title: 'Attack',
    subtitle: 'Threatening to capture',
    description:
      "While it would be nice of your opponent to let you capture all of their stones, they usually don't want to let you. Luckily, it's still possible to gain territory with just the threat of capture.",
    endDescription:
      "Threatening to capture is a good way to gain territory. In the next section we'll talk about ways to respond to attacks.",
    image: '/images/learn/bowman.svg',
    lessons: [
      {
        description:
          "Even if you can't capture, you can threaten to capture to push around your opponent",
        boardSize: 9,
        initialStones: {
          black: [
            [3, 3],
            [5, 3],
            [6, 4],
            [2, 5]
          ],
          white: [
            [6, 1],
            [2, 2],
            [3, 2],
            [6, 3]
          ]
        },
        turn: 'black',
        solution: [
          [7, 3],
          [6, 2]
        ],
        hints: { 0: [7, 3] }
      },
      {
        description:
          "Capturing White's stone would be impossible. But you can solidify your wall while they defend.",
        boardSize: 9,
        initialStones: {
          black: [
            [5, 3],
            [4, 4],
            [5, 4],
            [2, 5]
          ],
          white: [
            [2, 2],
            [6, 2],
            [4, 3],
            [1, 4]
          ]
        },
        turn: 'black',
        solution: [
          [3, 3],
          [4, 2],
          [2, 3]
        ],
        hints: { 0: [3, 3], 2: [2, 3] }
      },
      {
        description:
          'It can be helpful to sacrifice stones in exchange for a good wall. The initial exchange is good for Black, and White really should not spend extra moves capturing the stone.',
        boardSize: 9,
        initialStones: {
          black: [
            [4, 3],
            [5, 4]
          ],
          white: [
            [5, 3],
            [6, 4]
          ]
        },
        turn: 'black',
        solution: [
          [6, 3],
          [5, 2],
          [6, 5],
          [7, 4],
          [4, 5],
          [6, 2],
          [4, 2],
          [7, 3],
          [7, 5]
        ],
        hints: { 0: [6, 3], 2: [6, 5], 4: [4, 5], 6: [4, 2], 8: [7, 5] }
      },
      {
        description:
          "It's often a good idea to separate your opponent's stones. You don't need to capture, but you can take profit from multiple weak groups.",
        boardSize: 9,
        initialStones: {
          black: [
            [4, 4],
            [6, 4]
          ],
          white: [
            [2, 4],
            [4, 6]
          ]
        },
        turn: 'black',
        solution: [
          [3, 5],
          [2, 5],
          [3, 6]
        ],
        hints: { 0: [3, 5], 2: [3, 6] }
      },
      {
        description:
          'Even the threat of separation usually prompts a response. Play at the marked stones to threaten to disconnect White at triangle.',
        boardSize: 9,
        initialStones: {
          black: [
            [2, 4],
            [6, 4]
          ],
          white: [
            [2, 2],
            [6, 2]
          ]
        },
        turn: 'black',
        solution: [
          [4, 3],
          [4, 2],
          [5, 3],
          [5, 2],
          [3, 3],
          [3, 2]
        ],
        hints: { 0: [4, 3], 2: [5, 3], 4: [3, 3] },
        markers: {
          0: [{ x: 4, y: 2, type: 'triangle' }],
          2: [{ x: 5, y: 2, type: 'triangle' }],
          4: [{ x: 3, y: 2, type: 'triangle' }]
        }
      }
    ]
  },
  {
    id: 'defense',
    category: 'fundamentals',
    title: 'Defense',
    subtitle: 'Preventing capture',
    description:
      "Choosing whether you need to defend or if you can counterattack is a key tension in the game. In these exercises we'll show some common scenarios for saving and sacrificing your stones.",
    endDescription:
      "Knowing the difference for when to attack versus when to defend is one of the most important skills in Go. But it's important to properly predict what the outcome will be of both decisions. That's called Reading, and it's the next section.",
    image: '/images/learn/bolt-shield.svg',
    lessons: [
      {
        description: 'White is threatening to take your stone. Defend it.',
        boardSize: 9,
        initialStones: {
          black: [
            [5, 2],
            [2, 3],
            [4, 5]
          ],
          white: [
            [4, 4],
            [3, 5],
            [4, 6]
          ]
        },
        turn: 'black',
        solution: [[5, 5]],
        hints: { 0: [5, 5] }
      },
      {
        description: 'White is threatening to take one stone. Play at the hint to prevent capture.',
        boardSize: 9,
        initialStones: {
          black: [
            [5, 5],
            [5, 6],
            [5, 7],
            [6, 8]
          ],
          white: [
            [4, 5],
            [4, 6],
            [4, 7],
            [4, 8],
            [5, 8]
          ]
        },
        turn: 'black',
        solution: [[6, 7]],
        hints: { 0: [6, 7] }
      },
      {
        description:
          'White is threatening to take two stones. Play at the hint to prevent capture.',
        boardSize: 9,
        initialStones: {
          black: [
            [5, 4],
            [5, 5],
            [5, 6],
            [4, 7],
            [4, 8]
          ],
          white: [
            [4, 4],
            [4, 5],
            [4, 6],
            [3, 7],
            [3, 8]
          ]
        },
        turn: 'black',
        solution: [[5, 7]],
        hints: { 0: [5, 7] }
      },
      {
        description:
          'White is trying to surround 3 stones but the move at triangle was too agressive. Counterattack! ',
        boardSize: 9,
        initialStones: {
          black: [
            [4, 3],
            [4, 4],
            [4, 5],
            [5, 6],
            [5, 7]
          ],
          white: [
            [3, 3],
            [3, 4],
            [3, 5],
            [5, 5],
            [4, 6]
          ]
        },
        turn: 'black',
        solution: [
          [3, 6],
          [4, 7],
          [3, 7],
          [4, 8],
          [5, 8],
          [3, 8],
          [2, 8]
        ],
        hints: { 0: [3, 6], 2: [3, 7], 4: [5, 8], 6: [2, 8] },
        markers: { 0: [{ x: 4, y: 6, type: 'triangle' }] }
      },
      {
        description:
          "White is overextended and would need 3 moves in a row to capture Black's stones. Time to counterattack!",
        boardSize: 9,
        initialStones: {
          black: [
            [3, 5],
            [4, 5],
            [4, 6],
            [5, 7]
          ],
          white: [
            [2, 5],
            [3, 6],
            [5, 6],
            [4, 7]
          ]
        },
        turn: 'black',
        solution: [
          [3, 7],
          [2, 6],
          [4, 8]
        ],
        hints: { 0: [3, 7], 2: [4, 8] }
      }
    ]
  },
  {
    id: 'reading',
    category: 'fundamentals',
    title: 'Reading',
    subtitle: 'Predicting the future',
    description:
      "Knowing the difference between good moves and bad moves comes down to figuring out the best move for both sides. In these lessons we'll play out the outcome of both playing and not playing some critical moves.",
    image: '/images/learn/crystal-ball.svg',
    lessons: [
      {
        description:
          "As we saw in the Territory lessons, Black should not try to save these 3 stones. It's better to build a wall and force White to capture them.",
        boardSize: 9,
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
          "Trying to save the stones doesn't work, you lose more stones and don't get to wall off your territory! Here's one example of a sequence that doesn't work. Can you read out the others?",
        boardSize: 9,
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
          [7, 3],
          [7, 4],
          [8, 3],
          [8, 4]
        ],
        hints: { 0: [7, 3], 2: [8, 3] }
      },
      {
        description:
          "There's an important defensive point in Black's group that both players have missed. What happens if White plays it first?",
        boardSize: 9,
        initialStones: {
          black: [
            [3, 0],
            [3, 1],
            [4, 1],
            [4, 2],
            [4, 3],
            [1, 4],
            [2, 4],
            [4, 4],
            [5, 5],
            [1, 7],
            [2, 7],
            [3, 7],
            [4, 7],
            [5, 7],
            [1, 8],
            [5, 8]
          ],
          white: [
            [4, 0],
            [5, 0],
            [5, 1],
            [5, 2],
            [5, 3],
            [6, 4],
            [0, 6],
            [1, 6],
            [2, 6],
            [3, 6],
            [4, 6],
            [5, 6],
            [7, 6],
            [0, 7],
            [6, 7],
            [0, 8],
            [6, 8]
          ]
        },
        turn: 'black',
        solution: [
          [6, 5],
          [3, 8],
          [6, 6],
          [4, 8],
          [2, 8],
          [3, 8],
          [4, 8],
          [3, 8]
        ],
        hints: { 0: [6, 5], 2: [6, 6], 4: [2, 8], 6: [4, 8] },

        markers: {
          0: [{ x: 3, y: 8, type: 'triangle' }]
        }
      },
      {
        description:
          'Black needs to save the group, even though it lets White play somewhere important.',
        boardSize: 9,
        initialStones: {
          black: [
            [3, 0],
            [3, 1],
            [4, 1],
            [4, 2],
            [4, 3],
            [1, 4],
            [2, 4],
            [4, 4],
            [5, 5],
            [1, 7],
            [2, 7],
            [3, 7],
            [4, 7],
            [5, 7],
            [1, 8],
            [5, 8]
          ],
          white: [
            [4, 0],
            [5, 0],
            [5, 1],
            [5, 2],
            [5, 3],
            [6, 4],
            [0, 6],
            [1, 6],
            [2, 6],
            [3, 6],
            [4, 6],
            [5, 6],
            [7, 6],
            [0, 7],
            [6, 7],
            [0, 8],
            [6, 8]
          ]
        },
        turn: 'black',
        solution: [
          [3, 8],
          [6, 5]
        ],
        hints: { 0: [3, 8] }
      }
    ]
  },
  {
    id: 'big-moves',
    category: 'fundamentals',
    title: 'Big moves',
    subtitle: 'Choosing where to play',
    description:
      'Finding the most important move is the core challenge of the game. For beginners, this means finding the balance between fast moves and solid moves.',
    image: '/images/learn/globe.svg',
    lessons: [
      {
        description:
          'After learning about territory, beginners often try to slowly make walls. Here are some moves Black can play while White moves slowly.Gain an advantage as Black while White moves slowly.',
        boardSize: 9,
        initialStones: {
          black: [],
          white: []
        },
        turn: 'black',
        solution: [
          [5, 2],
          [2, 8],
          [6, 6],
          [2, 7],
          [2, 3],
          [2, 6],
          [3, 5],
          [1, 5],
          [4, 6],
          [0, 5]
        ],
        hints: { 0: [5, 2], 2: [6, 6], 4: [2, 3], 6: [3, 5], 8: [4, 6] }
      },
      {
        description:
          "For beginners, the specific space played in the opening isn't so important. It's worth experimenting to find the differences!",
        boardSize: 9,
        initialStones: {
          black: [],
          white: []
        },
        turn: 'black',
        solution: [
          [6, 2],
          [2, 6],
          [6, 6],
          [2, 2],
          [5, 4],
          [3, 4]
        ],
        hints: { 0: [6, 2], 2: [6, 6], 4: [5, 4] }
      },
      {
        description:
          "In contrast, exact placement is important when capturing is involved. White is threatening to capture by playing at the triangle. It's urgent to save the stones, even if black would rather play elsewhere.",
        boardSize: 9,
        initialStones: {
          black: [
            [6, 2],
            [1, 4],
            [4, 4],
            [5, 4],
            [1, 5],
            [2, 5],
            [3, 5],
            [1, 6],
            [4, 6],
            [6, 6],
            [4, 7]
          ],
          white: [
            [2, 2],
            [1, 3],
            [3, 3],
            [0, 4],
            [2, 4],
            [3, 4],
            [0, 5],
            [4, 5],
            [2, 6],
            [3, 6],
            [0, 7],
            [1, 7]
          ]
        },
        turn: 'black',
        solution: [
          [5, 5],
          [0, 6],
          [4, 5]
        ],
        hints: { 0: [5, 5], 2: [4, 5] },
        markers: {
          0: [{ x: 0, y: 6, type: 'triangle' }]
        }
      }
    ]
  },
  // {
  //   id: 'sente',
  //   category: 'intermediate',
  //   title: 'Sente',
  //   subtitle: 'Keeping the initiative',
  //   description: '',
  //   image: '/images/learn/sprint.svg',
  //   lessons: [
  //     {
  //       description: '',
  //       boardSize: 9,
  //       initialStones: { black: [], white: [] },
  //       turn: 'black',
  //       goal: '',
  //       solution: []
  //     }
  //   ]
  // },
  {
    id: 'tesuji',
    category: 'intermediate',
    title: 'Tesuji',
    subtitle: 'Tricks for capturing stones',
    description:
      'There are lots of tricky ways to take stones. Recognizing these takes some practice, but this section gives a taste of the kinds of moves that are possible.',
    image: '/images/learn/magic-hat.svg',
    lessons: [
      {
        description:
          "Trying to capture this stone directly doesn't work! It can escape and connect to another stone.",
        boardSize: 9,
        initialStones: {
          black: [
            [3, 3],
            [3, 4],
            [4, 5],
            [5, 5]
          ],
          white: [
            [6, 2],
            [4, 4]
          ]
        },
        turn: 'black',
        solution: [
          [4, 3],
          [5, 4],
          [6, 4],
          [5, 3],
          [5, 2],
          [6, 3]
        ],
        hints: { 0: [4, 3], 2: [6, 4], 4: [5, 2] }
      },
      {
        description: 'This tactic for capturing is called a Net. There is no escape for White.',
        boardSize: 9,
        initialStones: {
          black: [
            [3, 3],
            [3, 4],
            [4, 5],
            [5, 5]
          ],
          white: [
            [6, 2],
            [4, 4]
          ]
        },
        turn: 'black',
        solution: [
          [5, 3],
          [5, 4],
          [6, 4],
          [4, 3],
          [4, 2]
        ],
        hints: { 0: [5, 3], 2: [6, 4], 4: [4, 2] }
      },
      {
        description:
          'The obvious move to capture two stones does not work for Black. White can connect and the situation is settled.',
        boardSize: 9,
        initialStones: {
          black: [
            [2, 3],
            [3, 3],
            [3, 4],
            [3, 5],
            [3, 6],
            [5, 6],
            [4, 7],
            [1, 8],
            [4, 8]
          ],
          white: [
            [2, 4],
            [2, 5],
            [2, 6],
            [0, 7],
            [1, 7],
            [3, 7],
            [3, 8]
          ]
        },
        turn: 'black',
        solution: [
          [2, 8],
          [2, 7]
        ],
        hints: { 0: [2, 8] }
      },
      {
        description:
          'White can play a non-obvious move called a Snapback to sacrifice a stone to capture more stones.',
        boardSize: 9,
        initialStones: {
          black: [
            [2, 3],
            [3, 3],
            [3, 4],
            [3, 5],
            [3, 6],
            [5, 6],
            [4, 7],
            [1, 8],
            [4, 8]
          ],
          white: [
            [2, 4],
            [2, 5],
            [2, 6],
            [0, 7],
            [1, 7],
            [3, 7],
            [3, 8]
          ]
        },
        turn: 'black',
        solution: [
          [2, 7],
          [2, 8],
          [2, 7]
        ],
        hints: { 0: [2, 7], 2: [2, 7] }
      },
      {
        description: 'Capturing these stones directly does not work.',
        boardSize: 9,
        initialStones: {
          black: [
            [6, 2],
            [5, 4],
            [1, 5],
            [2, 5],
            [5, 5],
            [0, 6],
            [1, 6],
            [3, 6],
            [4, 6],
            [5, 6],
            [0, 7],
            [4, 7],
            [0, 8]
          ],
          white: [
            [7, 3],
            [6, 5],
            [2, 6],
            [6, 6],
            [1, 7],
            [2, 7],
            [3, 7],
            [5, 7],
            [6, 7],
            [4, 8]
          ]
        },
        turn: 'black',
        solution: [
          [1, 8],
          [3, 8],
          [2, 8],
          [5, 8]
        ],
        hints: { 0: [1, 8], 2: [2, 8] }
      },
      {
        description: "Black can use a Throw In to capture White's stones.",
        boardSize: 9,
        initialStones: {
          black: [
            [6, 2],
            [5, 4],
            [1, 5],
            [2, 5],
            [5, 5],
            [0, 6],
            [1, 6],
            [3, 6],
            [4, 6],
            [5, 6],
            [0, 7],
            [4, 7],
            [0, 8]
          ],
          white: [
            [7, 3],
            [6, 5],
            [2, 6],
            [6, 6],
            [1, 7],
            [2, 7],
            [3, 7],
            [5, 7],
            [6, 7],
            [4, 8]
          ]
        },
        turn: 'black',
        solution: [
          [3, 8],
          [2, 8],
          [1, 8],
          [3, 8],
          [5, 8]
        ],
        hints: { 0: [3, 8], 2: [1, 8], 4: [5, 8] }
      }
    ]
  },
  {
    id: 'joseki',
    category: 'intermediate',
    title: 'Joseki',
    subtitle: 'Learning opening patterns',
    description:
      "Well known opening patterns are known as Joseki. There are a lot, and they're not as critical as in Chess. That being said, memorizing a few will help you feel less lost in the opening, even if they don't make too much sense yet.",
    endDescription:
      "You've now seen a few Joseki. While these sequences might not make sense yet, they can help you feel less lost when starting the game.",
    image: '/images/learn/tied-scroll.svg',
    lessons: [
      {
        description:
          'This is a common sequence for a corner invasion that both sides can be satisfied with.',
        boardSize: 19,
        initialStones: {
          black: [],
          white: [[3, 15]]
        },
        turn: 'black',
        solution: [
          [2, 16],
          [2, 15],
          [3, 16],
          [4, 16],
          [4, 17],
          [5, 16],
          [5, 17],
          [6, 16],
          [1, 15],
          [1, 14],
          [1, 16],
          [2, 13]
        ],
        hints: { 0: [2, 16], 2: [3, 16], 4: [4, 17], 6: [5, 17], 8: [1, 15], 10: [1, 16] }
      },
      {
        description: 'White gets to choose which way they would like to make a wall.',
        boardSize: 19,
        initialStones: {
          black: [],
          white: [[3, 15]]
        },
        turn: 'black',
        solution: [
          [2, 16],
          [3, 16],
          [2, 15],
          [2, 14],
          [1, 14],
          [2, 13],
          [1, 13],
          [2, 12],
          [3, 17],
          [4, 17],
          [2, 17],
          [5, 16]
        ],
        hints: { 0: [2, 16], 2: [2, 15], 4: [1, 14], 6: [1, 13], 8: [3, 17], 10: [2, 17] }
      },
      {
        description: 'Play the sequence again as the defender.',
        boardSize: 19,
        initialStones: {
          black: [[3, 15]],
          white: [[2, 16]]
        },
        turn: 'black',
        solution: [
          [2, 15],
          [3, 16],
          [4, 16],
          [4, 17],
          [5, 16],
          [5, 17],
          [6, 16],
          [1, 15],
          [1, 14],
          [1, 16],
          [2, 13]
        ],
        hints: { 0: [2, 15], 2: [4, 16], 4: [5, 16], 6: [6, 16], 8: [1, 14], 10: [2, 13] }
      },
      {
        description: 'Now defend the other way!',
        boardSize: 19,
        initialStones: {
          black: [[3, 15]],
          white: [[2, 16]]
        },
        turn: 'black',
        solution: [
          [3, 16],
          [2, 15],
          [2, 14],
          [1, 14],
          [2, 13],
          [1, 13],
          [2, 12],
          [3, 17],
          [4, 17],
          [2, 17],
          [5, 16]
        ],
        hints: { 0: [3, 16], 2: [2, 14], 4: [2, 13], 6: [2, 12], 8: [4, 17], 10: [5, 16] }
      },
      {
        description:
          'Another common approach to a corner is to come from the side. Here is a standard and beginner-friendly continuation.',
        boardSize: 19,
        initialStones: {
          black: [],
          white: [[3, 15]]
        },
        turn: 'black',
        solution: [
          [5, 16],
          [2, 13],
          [3, 17],
          [2, 16],
          [8, 16]
        ],
        hints: { 0: [5, 16], 2: [3, 17], 4: [8, 16] }
      },
      {
        description: 'Defend with the same Joseki!',
        boardSize: 19,
        initialStones: {
          black: [[3, 15]],
          white: [[5, 16]]
        },
        turn: 'black',
        solution: [
          [2, 13],
          [3, 17],
          [2, 16],
          [8, 16]
        ],
        hints: { 0: [2, 13], 2: [2, 16] }
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
    href: '/?setup=ai'
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
