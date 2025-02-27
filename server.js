// Завантаження змінних оточення з файлу .env
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// Функція для форматування часу в "хв:сек" (наприклад, "1:12")
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Функція для перемішування масиву (алгоритм Фішера-Єйтса)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Обмін елементів
  }
  return array;
}

const getPlaylist = () => {
  const musicDir = './music';
  return fs.readdirSync(musicDir)
    .filter(file => path.extname(file).toLowerCase() === '.mp3')
    .map(file => path.join(musicDir, file));
};

// Глобальні змінні
let trackDurations = {};
let playlist = shuffleArray([...getPlaylist()]); // Ініціалізуємо перемішаний плейлист
let currentTrack = 0;
let isPlaying = false;
let currentTrackName = playlist.length > 0 ? path.basename(playlist[currentTrack], '.mp3') : 'Немає треків';
let currentPlaybackTime = 0; // Поточний час відтворення в секундах
let playbackTimer = null; // Таймер для відстеження прогресу

// Зберігаємо поточний процес ffmpeg для автономного відтворення
let autoplayProcess = null;

// Отримання тривалості треку
function getTrackDuration(filePath, callback) {
  ffmpeg.ffprobe(filePath, (err, metadata) => {
    if (err) {
      console.error(`Не вдалося отримати тривалість для ${filePath}:`, err);
      callback(0); // Повертаємо 0, якщо не вдалося отримати тривалість
    } else {
      const duration = metadata.format.duration || 0;
      callback(duration);
    }
  });
}

// Функція для автономного відтворення плейлиста
function startAutoplay() {
  if (playlist.length === 0) {
    console.log('У папці music немає MP3-файлів');
    return;
  }

  const playNextTrack = () => {
    if (currentTrack >= playlist.length) {
      // Якщо досягнуто кінця плейлиста, перемішуємо його і скидаємо currentTrack
      playlist = shuffleArray([...getPlaylist()]); // Створюємо нову копію плейлиста і перемішуємо
      currentTrack = 0;
      trackDurations = {}; // Очищаємо кеш тривалостей для нового порядку
    }

    const track = playlist[currentTrack];
    currentTrackName = path.basename(track, '.mp3');

    // Отримуємо тривалість треку перед відтворенням
    getTrackDuration(track, (duration) => {
      trackDurations[track] = duration;
      console.log(`Автовідтворення: ${currentTrackName} (тривалість: ${formatTime(duration)})`);

      isPlaying = true;
      currentPlaybackTime = 0; // Скидаємо поточний час на початок

      // Очищаємо попередній таймер, якщо він існує
      if (playbackTimer) {
        clearInterval(playbackTimer);
        playbackTimer = null; // Скидаємо посилання на таймер
        console.log('Попередній таймер очищено');
      }

      // Запускаємо новий таймер для відстеження прогресу кожну секунду
      playbackTimer = setInterval(() => {
        if (isPlaying) {
          currentPlaybackTime++;
          const totalTime = trackDurations[track] || 0;
          console.log(`${currentTrackName} - (${formatTime(currentPlaybackTime)}/${formatTime(totalTime)})`);
          // Якщо поточний час перевищує тривалість (через помилку), завершуємо таймер
          if (currentPlaybackTime >= totalTime && totalTime > 0) {
            console.log('Таймер перевищив тривалість треку — зупиняємо');
            isPlaying = false;
            clearInterval(playbackTimer);
            playbackTimer = null;
            currentTrack++;
            playNextTrack();
          }
        }
      }, 1000); // Кожну секунду

      // Зберігаємо поточний процес для внутрішнього відстеження, але не запускаємо тут стрімінг для Vercel
      autoplayProcess = {
        track,
        duration,
      };
    });
  };

  playNextTrack();
}

// Експортуємо глобальні змінні та функції для використання в серверних функціях Vercel
module.exports = {
  playlist,
  trackDurations,
  currentTrack,
  isPlaying,
  currentTrackName,
  currentPlaybackTime,
  playbackTimer,
  autoplayProcess,
  startAutoplay,
  getTrackDuration,
};