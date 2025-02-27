import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const logoPath = './images/radio-logo.png'; // Шлях до зображення (зміни на потрібний формат, наприклад, .jpg)
  if (fs.existsSync(logoPath)) {
    res.setHeader('Content-Type', 'image/png'); // Зміни на 'image/jpeg', якщо файл .jpg
    res.setHeader('Access-Control-Allow-Origin', '*');
    fs.createReadStream(logoPath).pipe(res);
  } else {
    res.status(404).send('Зображення логотипу не знайдено');
  }
}