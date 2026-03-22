import '../src/lib/theme.css';
import '../src/lib/base.css';
import '../src/lib/nav/nav.css';
import '../src/lib/lobby/lobby.css';
import '../src/lib/game/game.css';
import LayoutDecorator from './LayoutDecorator.svelte';

/** @type { import('@storybook/sveltekit').Preview } */
const preview = {
  decorators: [
    (_, context) => ({
      Component: LayoutDecorator,
      props: {
        layout: context.parameters?.layout ?? ''
      }
    })
  ],

  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },

    a11y: {
      test: 'error'
    },

    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '800px' } }
      }
    }
  }
};

export default preview;
