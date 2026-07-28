import '../../styles/print-room.css';

const shareButtons = document.querySelectorAll<HTMLButtonElement>('[data-share]');

const setButtonState = (button: HTMLButtonElement, label: string) => {
  const text = button.querySelector('span');
  if (!text) return;
  const previous = text.textContent ?? 'Copy review link';
  text.textContent = label;
  window.setTimeout(() => {
    text.textContent = previous;
  }, 1800);
};

for (const button of shareButtons) {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setButtonState(button, 'Link copied');
    } catch {
      window.prompt('Copy this private review link:', window.location.href);
    }
  });
}

const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('.pr-nav a')];
const sections = navLinks
  .map((link) => document.querySelector<HTMLElement>(link.hash))
  .filter((section): section is HTMLElement => Boolean(section));

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      for (const link of navLinks) {
        link.toggleAttribute('aria-current', link.hash === `#${visible.target.id}`);
      }
    },
    { rootMargin: '-20% 0px -65%', threshold: [0.05, 0.25, 0.5] },
  );
  sections.forEach((section) => observer.observe(section));
}
