const { Readable } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const {
  playlist,
  currentTrack,
  isPlaying,
  startAutoplay,
  getTrackDuration,
} = require('../server');

export default function handler(req, res) {
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (playlist.length === 0) {
    res.status(404).send('У папці music немає MP3-файлів');
    return;
  }

  // Якщо автовидворення ще не почалося, запускаємо його
  if (!isPlaying) {
    startAutoplay();
  }

  const track = playlist[currentTrack];
  const stream = fs.createReadStream(track);

  ffmpeg(stream)
    .format('mp3')
    .on('error', (err) => {
      console.error('Помилка стрімінгу для клієнта:', err);
      res.status(500).end();
    })
    .pipe(res)
    .on('close', () => {
      console.log('Клієнт від’єднався від стріму');
    });
}