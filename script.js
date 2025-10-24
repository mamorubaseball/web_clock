// HTML要素を取得
const hourHand = document.querySelector('[data-hour-hand]');
const minuteHand = document.querySelector('[data-minute-hand]');
const secondHand = document.querySelector('[data-second-hand]');
const timerDisplay = document.getElementById('timer-display');
const timerButtons = document.querySelectorAll('.timer-btn');

let timerInterval; // カウントダウン用タイマーID
let alarmStopTimer; // ★ アラーム自動停止用タイマーID
let currentAlarmSound = null; // ★ 現在再生中のアラーム音

// 時計を動かす関数
function setClock() {
  const currentDate = new Date();
  const secondsRatio = currentDate.getSeconds() / 60;
  const minutesRatio = (secondsRatio + currentDate.getMinutes()) / 60;
  const hoursRatio = (minutesRatio + currentDate.getHours()) / 12;
  setRotation(secondHand, secondsRatio);
  setRotation(minuteHand, minutesRatio);
  setRotation(hourHand, hoursRatio);
}

// 針の角度を設定する関数
function setRotation(element, rotationRatio) {
  element.style.setProperty('--rotation', rotationRatio * 360);
}

// 1秒ごとに時計を更新
setInterval(setClock, 1000);
setClock(); // 最初に一度呼び出す

// タイマーボタンにクリックイベントを設定
timerButtons.forEach(button => {
  button.addEventListener('click', () => {
    const minutes = parseInt(button.dataset.time);
    startTimer(minutes * 60);
  });
});

// タイマーを開始する関数
function startTimer(durationInSeconds) {
  // 既存のタイマーがあれば停止
  clearInterval(timerInterval);

  // ★ もし古いアラームが鳴っていたら停止し、10秒タイマーもキャンセル
  if (currentAlarmSound) {
    currentAlarmSound.pause();
    currentAlarmSound.currentTime = 0;
  }
  if (alarmStopTimer) {
    clearTimeout(alarmStopTimer);
  }

  // ★ 1. アラーム音を読み込み、ループ設定にする
  const alarmSound = new Audio('alarm.mp3');
  alarmSound.loop = true; // 10秒間鳴らし続けるためにループをオン
  currentAlarmSound = alarmSound; // 他から停止できるよう変数に保持

  let timer = durationInSeconds;
  const endTime = Date.now() + durationInSeconds * 1000;

  // タイマー表示をフェードイン
  timerDisplay.style.opacity = '1';

  function updateCountdown() {
    const remainingTime = Math.round((endTime - Date.now()) / 1000);

    if (remainingTime < 0) {
      clearInterval(timerInterval);
      timerDisplay.textContent = "Done!";

      // ★ 2. アラームを再生
      alarmSound.play();

      // ★ 3.【重要】10秒後にアラームを停止するタイマーをセット
      alarmStopTimer = setTimeout(() => {
        alarmSound.pause();
        alarmSound.currentTime = 0; // 再生位置をリセット
      }, 10000); // 10000ミリ秒 = 10秒

      // "Done!"の文字だけを3秒後にフェードアウト
      setTimeout(() => {
        timerDisplay.style.opacity = '0';
      }, 3000);
      return;
    }

    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;

    // 0埋めして表示 (例: 05:09)
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  updateCountdown(); // すぐに一度実行して表示
  timerInterval = setInterval(updateCountdown, 1000);
}