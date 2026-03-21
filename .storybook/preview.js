import '../src/lib/theme.css';
import '../src/lib/base.css';
import '../src/lib/nav/nav.css';

/** @type { import('@storybook/sveltekit').Preview } */
const preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i
			}
		},

		a11y: {
			// 'todo' - show a11y violations in the test UI only
			// 'error' - fail CI on a11y violations
			// 'off' - skip a11y checks entirely
			test: 'error'
		}
	}
};

export default preview;
