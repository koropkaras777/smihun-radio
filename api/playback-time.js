const { playlist, currentTrack, trackDurations, currentPlaybackTime } = require('../server');

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (playlist.length === 0) {
    res.json({ currentTime: 0, totalTime: 0, track: 'Немає треків' });
  } else {
    const track = playlist[currentTrack];
    const totalTime = trackDurations[track] || 0;
    res.json({ currentTime: currentPlaybackTime, totalTime: totalTime, track: path.basename(track, '.mp3') });
  }
}