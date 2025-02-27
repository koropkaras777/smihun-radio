const { currentTrackName, playlist } = require('../server');

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (playlist.length === 0) {
    res.json({ track: 'Немає треків' });
  } else {
    res.json({ track: currentTrackName });
  }
}