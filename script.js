import * as CandleTheme from './theme_candle.js';
import * as ClockTheme from './theme_clock.js';

const themes = {
  candle: CandleTheme,
  clock: ClockTheme
};

let currentThemeId = 'candle';
let activeThemeInstance = null;
const container = document.getElementById('canvas-container');

function switchTheme(themeId) {
  if (activeThemeInstance) {
    if (activeThemeInstance.unmount) activeThemeInstance.unmount();
  }

  document.body.className = `theme-${themeId}`;
  currentThemeId = themeId;
  const ThemeModule = themes[themeId];

  container.innerHTML = '';

  // Mount
  activeThemeInstance = ThemeModule.mount(container);

  const switchBtn = document.getElementById('theme-switch');
  if (switchBtn) {
    switchBtn.textContent = themeId === 'candle' ? 'Switch to Clock' : 'Switch to Candle';
  }
}

function init() {
  const switchBtn = document.getElementById('theme-switch');
  if (switchBtn) {
    // Remove old listeners just in case
    const newBtn = switchBtn.cloneNode(true);
    switchBtn.parentNode.replaceChild(newBtn, switchBtn);

    newBtn.addEventListener('click', () => {
      const next = currentThemeId === 'candle' ? 'clock' : 'candle';
      switchTheme(next);
    });
  }

  // Start with Clock as updated default (user request)
  // Actually user requested Clock as default in previous turn
  switchTheme('clock');
}

window.onerror = function (msg, url, line) {
  console.error(msg, url, line);
}

init();