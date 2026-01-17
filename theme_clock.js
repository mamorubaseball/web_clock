
let intervalId;
let clockIntervalId;
let alarmStopTimer;
let currentAlarmSound = null;

// Helper to create elements
function createElement(tag, className, parent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (parent) parent.appendChild(el);
    return el;
}

export function mount(container) {
    // 1. Create HTML Structure within container
    // Clock container
    const clockEl = createElement('div', 'clock', container);

    // Numbers
    for (let i = 1; i <= 12; i++) {
        const num = createElement('div', 'number', clockEl);
        num.style.setProperty('--rotation', `${i * 30}deg`);
        num.innerText = i;
    }

    // Hands
    const hourHand = createElement('div', 'hand hour', clockEl);
    hourHand.setAttribute('data-hour-hand', '');

    const minuteHand = createElement('div', 'hand minute', clockEl);
    minuteHand.setAttribute('data-minute-hand', '');

    const secondHand = createElement('div', 'hand second', clockEl);
    secondHand.setAttribute('data-second-hand', '');

    // Timer Display (inside clock for this design)
    const timerDisplay = createElement('div', 'timer-display', clockEl);
    timerDisplay.id = 'clock-timer-display'; // unique ID

    // Controls (Separate container or reuse common UI layer?)
    // The design had controls below.
    // We can append controls to container
    const controls = createElement('div', 'timer-controls', container);

    const times = [5, 10, 30, 45, 60, 90];
    times.forEach(t => {
        const btn = createElement('button', 'timer-btn', controls);
        btn.dataset.time = t;
        btn.innerText = `${t}min`;
        btn.onclick = () => {
            startTimer(t * 60, timerDisplay);
        };
    });

    // 2. Start Clock Logic
    startClock(hourHand, minuteHand, secondHand);

    return {
        startTimer: (min) => {
            // Interface match if needed, but buttons handle it internally here
            startTimer(min * 60, timerDisplay);
        },
        stopTimer: stopTimer,
        unmount: unmount
    };
}

export function unmount() {
    stopTimer();
    clearInterval(clockIntervalId);
    // Container clearing is handled by main script usually, but we can stop sounds
}

function startClock(hourHand, minuteHand, secondHand) {
    function setClock() {
        const currentDate = new Date();
        const secondsRatio = currentDate.getSeconds() / 60;
        const minutesRatio = (secondsRatio + currentDate.getMinutes()) / 60;
        const hoursRatio = (minutesRatio + currentDate.getHours()) / 12;

        setRotation(secondHand, secondsRatio);
        setRotation(minuteHand, minutesRatio);
        setRotation(hourHand, hoursRatio);
    }

    setClock();
    clockIntervalId = setInterval(setClock, 1000);
}

function setRotation(element, rotationRatio) {
    element.style.setProperty('--rotation', rotationRatio * 360);
}

function startTimer(durationInSeconds, displayEl) {
    clearInterval(intervalId);

    if (currentAlarmSound) {
        currentAlarmSound.pause();
        currentAlarmSound.currentTime = 0;
    }
    if (alarmStopTimer) {
        clearTimeout(alarmStopTimer);
    }

    const alarmSound = new Audio('alarm.mp3');
    alarmSound.loop = true;
    currentAlarmSound = alarmSound;

    const endTime = Date.now() + durationInSeconds * 1000;

    displayEl.style.opacity = '1';

    function updateCountdown() {
        const remaining = Math.round((endTime - Date.now()) / 1000);

        if (remaining < 0) {
            clearInterval(intervalId);
            displayEl.textContent = "Done!";
            alarmSound.play().catch(() => { });

            alarmStopTimer = setTimeout(() => {
                alarmSound.pause();
                alarmSound.currentTime = 0;
            }, 10000);

            setTimeout(() => {
                displayEl.style.opacity = '0';
            }, 3000);
            return;
        }

        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        displayEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    updateCountdown();
    intervalId = setInterval(updateCountdown, 1000);
}

function stopTimer() {
    clearInterval(intervalId);
    if (currentAlarmSound) {
        currentAlarmSound.pause();
        currentAlarmSound.currentTime = 0;
    }
    if (alarmStopTimer) {
        clearTimeout(alarmStopTimer);
    }
}
