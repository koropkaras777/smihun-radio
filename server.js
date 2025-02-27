// Завантаження змінних оточення з файлу .env
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
const app = express();

// Використовуємо process.env.PORT з fallback на 3000, якщо порт не вказаний
const port = process.env.PORT || 3000;

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

// Зберігаємо тривалість кожного треку
let trackDurations = {};
let playlist = getPlaylist();
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
      trackDurations = {}; // Очищаємо кеш тривалостей, щоб повторно отримати їх для нового порядку
    }

    const track = playlist[currentTrack];
    currentTrackName = path.basename(track, '.mp3');

    // Отримуємо тривалість треку перед відтворенням
    getTrackDuration(track, (duration) => {
      trackDurations[track] = duration;
      console.log(`Автовідтворення: ${currentTrackName} (тривалість: ${formatTime(duration)})`);

      const stream = fs.createReadStream(track);

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

      autoplayProcess = ffmpeg(stream)
        .format('mp3')
        .on('start', () => {
          console.log(`Початок відтворення: ${currentTrackName}`);
        })
        .on('end', () => {
          console.log(`Завершення відтворення: ${currentTrackName} (нормально)`);
          isPlaying = false;
          currentPlaybackTime = 0; // Скидаємо час після завершення
          if (playbackTimer) {
            clearInterval(playbackTimer);
            playbackTimer = null; // Скидаємо посилання на таймер
            console.log('Таймер очищено після завершення треку');
          }
          currentTrack++;
          // Повторно викликаємо playNextTrack для забезпечення переходу
          setTimeout(() => playNextTrack(), 100); // Невелика затримка для стабільності
        })
        .on('error', (err) => {
          console.error('Помилка автовидворення:', err);
          isPlaying = false;
          currentPlaybackTime = 0; // Скидаємо час при помилці
          if (playbackTimer) {
            clearInterval(playbackTimer);
            playbackTimer = null; // Скидаємо посилання на таймер
            console.log('Таймер очищено після помилки');
          }
          currentTrack++;
          // Повторно викликаємо playNextTrack для забезпечення переходу
          setTimeout(() => playNextTrack(), 100); // Невелика затримка для стабільності
        })
        .on('close', () => {
          console.log(`Закриття потоку для ${currentTrackName} (можливо, через помилку)`);
          if (isPlaying) {
            console.log('Потік закрито під час відтворення — спроба відновити');
            isPlaying = false;
            currentPlaybackTime = 0; // Скидаємо час
            if (playbackTimer) {
              clearInterval(playbackTimer);
              playbackTimer = null; // Скидаємо посилання на таймер
              console.log('Таймер очищено після закриття потоку');
            }
            currentTrack++;
            // Повторно викликаємо playNextTrack для забезпечення переходу
            setTimeout(() => playNextTrack(), 100); // Невелика затримка для стабільності
          }
        });
    });
  };

  playNextTrack();
}

// Ендпоінт для стрімінгу (підключення до поточного потоку без перезапуску)
app.get('/stream', (req, res) => {
  res.set({
    'Content-Type': 'audio/mpeg',
    'Transfer-Encoding': 'chunked',
    'Access-Control-Allow-Origin': '*', // Додаємо заголовок CORS для стріму
  });

  if (playlist.length === 0) {
    res.end('У папці music немає MP3-файлів');
    return;
  }

  // Завжди підключаємо клієнта до поточного треку, який відтворюється, не перезапускаючи автовидворення
  const track = playlist[currentTrack];
  const stream = fs.createReadStream(track);

  ffmpeg(stream)
    .format('mp3')
    .on('error', (err) => {
      console.error('Помилка стрімінгу для клієнта:', err);
      res.end();
    })
    .pipe(res)
    .on('close', () => {
      console.log('Клієнт від’єднався від стріму');
      // Не впливаємо на автовидворення при від’єднанні клієнта
    });
});

// Ендпоінт для отримання назви поточного треку
app.get('/current-track', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*', // Додаємо заголовок CORS для цього ендпоінту
  });

  if (playlist.length === 0) {
    res.json({ track: 'Немає треків' });
  } else {
    res.json({ track: currentTrackName });
  }
});

// Ендпоінт для отримання поточного часу відтворення та тривалості
app.get('/playback-time', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*', // Додаємо заголовок CORS для цього ендпоінту
  });

  if (playlist.length === 0) {
    res.json({ currentTime: 0, totalTime: 0, track: 'Немає треків' });
  } else {
    const track = playlist[currentTrack];
    const totalTime = trackDurations[track] || 0;
    res.json({ currentTime: currentPlaybackTime, totalTime: totalTime, track: currentTrackName });
  }
});

// Ендпоінт для зображення логотипу
app.get('/logo', (req, res) => {
  const logoPath = './images/radio-logo.png'; // Шлях до зображення (зміни на потрібний формат, наприклад, .jpg)
  if (fs.existsSync(logoPath)) {
    res.set({
      'Content-Type': 'image/png', // Зміни на 'image/jpeg', якщо файл .jpg
      'Access-Control-Allow-Origin': '*', // Додаємо заголовок CORS для зображення
    });
    fs.createReadStream(logoPath).pipe(res);
  } else {
    res.status(404).send('Зображення логотипу не знайдено');
  }
});

app.use(cors({
  origin: '*', // Дозволяє запити з будь-якого джерела для локального тестування
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Запускаємо сервер на вказаному порті
app.listen(port, () => {
  console.log(`Радіо працює на http://localhost:${port}`);
  // Запускаємо автовідтворення при старті сервера
  startAutoplay();
});