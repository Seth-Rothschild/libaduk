<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, fn, userEvent, within } from 'storybook/test';
  import GameChat from './GameChat.svelte';

  const { Story } = defineMeta({
    component: GameChat,
    tags: ['autodocs'],
    parameters: { layout: 'game-side' },
    args: {
      username: 'Alice',
      gameId: 'test123',
      gameStatus: 'playing',
      messages: [],
      initialNote: '',
      onSend: fn()
    }
  });
</script>

<Story name="Empty" />

<Story
  name="With messages"
  args={{
    messages: [
      { user: 'Alice', text: 'Hello' },
      { user: 'Bob', text: 'Good luck' },
      { user: 'Alice', text: 'Have fun!' },
      { user: 'Bob', text: 'You too!' }
    ]
  }}
/>

<Story
  name="Own messages highlighted"
  args={{
    messages: [
      { user: 'Alice', text: 'Nice move!' },
      { user: 'Bob', text: 'Thanks' },
      { user: 'Alice', text: 'That was tricky' }
    ]
  }}
/>

<Story
  name="System messages"
  args={{
    messages: [
      { system: true, text: 'Bob joined the game' },
      { user: 'Alice', text: 'Hello' },
      { system: true, text: 'Game started' }
    ]
  }}
/>

<Story
  name="Start presets (playing)"
  args={{
    gameStatus: 'playing',
    messages: []
  }}
/>

<Story
  name="End presets (gameover)"
  args={{
    gameStatus: 'gameover',
    messages: [
      { user: 'Alice', text: 'Nice move!' },
      { user: 'Bob', text: 'Thanks' }
    ]
  }}
/>

<Story
  name="No presets (waiting)"
  args={{
    gameStatus: 'waiting',
    messages: []
  }}
/>

<Story
  name="With existing note"
  args={{
    initialNote: 'Opponent plays aggressively on the right side.\nConsider invading at 3-3.'
  }}
/>

<Story
  name="Send message via Enter"
  args={{ messages: [] }}
  play={async ({ args, canvas }) => {
    const input = canvas.getByPlaceholderText('Please be nice in the chat!');
    await userEvent.type(input, 'Good game!{Enter}');
    await expect(args.onSend).toHaveBeenCalledWith('Good game!');
  }}
/>

<Story
  name="Click preset sends full text"
  args={{ gameStatus: 'playing', messages: [] }}
  play={async ({ args, canvas }) => {
    const glButton = canvas.getByText('gl');
    await userEvent.click(glButton);
    await expect(args.onSend).toHaveBeenCalledWith('Good luck');
  }}
/>

<Story
  name="Many messages (scrolling)"
  args={{
    messages: Array.from({ length: 30 }, (_, i) => ({
      user: i % 2 === 0 ? 'Alice' : 'Bob',
      text: `Message number ${i + 1}`
    }))
  }}
/>
