const http = require('http');
const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');

// Налаштування командного рядка
program
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера', parseInt)
  .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

program.parse();

const { host, port, cache: cacheDir } = program.opts();

// Створення директорії кешу, якщо не існує
(async () => {
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    console.log(`Директорія кешу створена/перевірена: ${path.resolve(cacheDir)}`);
  } catch (err) {
    console.error('Помилка створення директорії кешу:', err);
    process.exit(1);
  }
})();

// Створення HTTP-сервера
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Проксі-сервер запущений. Частина 1 завершена.');
});

server.listen(port, host, () => {
  console.log(`Сервер запущено на http://${host}:${port}`);
  console.log(`Кеш: ${path.resolve(cacheDir)}`);
});

// Обробка помилок сервера
server.on('error', (err) => {
  console.error('Помилка сервера:', err);
});

