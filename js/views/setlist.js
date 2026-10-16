// Placeholder: the #400 Set builder. Owned by the Set-builder agent; keep the same view interface.
import { html, pageHead, comingSoon } from '../ui.js';

export default {
  title: () => 'Set builder',
  render(root) {
    root.innerHTML = String(html`
      ${pageHead({ kicker: 'On-air queue', title: 'Set builder', sub: 'Build a running order for the next show.' })}
      ${comingSoon({ title: 'Coming soon', blurb: 'Search and add songs, reorder them, see when each was last played, and open every track on Spotify in one tap.', ic: 'queue' })}`);
  },
};
