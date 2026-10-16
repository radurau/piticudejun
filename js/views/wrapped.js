// Placeholder: "Piticu Wrapped" story slides. Owned by the Wrapped agent; keep the same view interface.
import { html, pageHead, comingSoon } from '../ui.js';

export default {
  title: () => 'Piticu Wrapped',
  render(root) {
    root.innerHTML = String(html`
      ${pageHead({ kicker: 'Story', title: 'Piticu Wrapped', sub: 'Six years of Monday nights, one tap at a time.' })}
      ${comingSoon({ title: 'Coming soon', blurb: 'Full-screen story slides with the big numbers of the show, ending on a card made for screenshots. Ready for #400.', ic: 'story' })}`);
  },
};
