const express = require('express');
const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

const allowedRoutes = {
  "/register": ["POST"],
  "/inventory": ["GET"],
  "/inventory/:id": ["GET", "PUT", "DELETE"],
  "/inventory/:id/photo": ["GET", "PUT"],
  "/search": ["POST"],
  "/RegisterForm.html": ["GET"],
  "/SearchForm.html": ["GET"]
};

// ----------------------
//  ПАРАМЕТРИ КОМАНДНОГО РЯДКА
// ----------------------
program
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера', parseInt)
  .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

program.parse();
const { host, port, cache: cacheDir } = program.opts();

// ----------------------
//  ПЕРЕВІРКА / СТВОРЕННЯ ДИРЕКТОРІЇ КЕШУ
// ----------------------
(async () => {
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    console.log(`Кеш директорія готова: ${path.resolve(cacheDir)}`);
  } catch (err) {
    console.error('Помилка створення директорії кешу:', err);
    process.exit(1);
  }
})();

// ----------------------
//  НАЛАШТУВАННЯ MULTER ДЛЯ ФОТО
// ----------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, cacheDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ----------------------
//  БАЗА ДАНИХ (в памʼяті сервера)
// ----------------------
let inventory = [];  // масив обʼєктів
let currentId = 1;

// ----------------------
//  СТВОРЕННЯ EXPRESS СЕРВЕРА
// ----------------------
const app = express();

// Для парсингу JSON
app.use(express.json());

// ----------------------
//  ТЕСТОВИЙ GET (тимчасовий)
// ----------------------
app.get('/', (req, res) => {
  res.send('Частина 1 + Express готові. Можна переходити до ендпоінтів інвентаря.');
});

// ----------------------
//  СТАРТ СЕРВЕРА
// ----------------------
app.listen(port, host, () => {
  console.log(`Сервер Express запущено: http://${host}:${port}`);
});
app.use(express.json());          
app.use(express.urlencoded({ extended: true }));  
// ----------------------
//  POST /register — реєстрація нового інвентаря
// ----------------------
app.post('/register', upload.single('photo'), async (req, res) => {
  const { inventory_name, description } = req.body;

  // Поле inventory_name — обов’язкове
  if (!inventory_name || inventory_name.trim() === "") {
    return res.status(400).json({ error: "Поле inventory_name є обов'язковим." });
  }

  // Фото може бути не обов'язковим (але коли є — multer зберіг)
  const photoPath = req.file ? req.file.filename : null;

  const newItem = {
    id: currentId++,
    name: inventory_name,
    description: description || "",
    photo: photoPath
  };

  inventory.push(newItem);

  return res.status(201).json({
    message: "Інвентар успішно зареєстровано",
    item: newItem
  });
});
// ----------------------
//  GET /inventory — список всіх інвентарних речей
// ----------------------
app.get('/inventory', (req, res) => {
  const list = inventory.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    photo: item.photo,
    photo_url: item.photo ? `/inventory/${item.id}/photo` : null
  }));

  res.status(200).json(list);
});
// ----------------------
//  GET /inventory/:id — отримання конкретної речі
// ----------------------
app.get('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);

  const item = inventory.find(x => x.id === id);

  if (!item) {
    return res.status(404).json({ error: "Річ з таким ID не знайдена" });
  }

  res.status(200).json({
    id: item.id,
    name: item.name,
    description: item.description,
    photo: item.photo,
    photo_url: item.photo ? `/inventory/${item.id}/photo` : null
  });
});
// ----------------------
//  PUT /inventory/:id — оновлення імені або опису
// ----------------------
app.use(express.json());
app.put('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(x => x.id === id);

  if (!item) {
    return res.status(404).json({ error: "Річ з таким ID не знайдена" });
  }

  const { name, description } = req.body;

  if (name !== undefined) item.name = name;
  if (description !== undefined) item.description = description;

  res.status(200).json({
    message: "Дані успішно оновлено",
    item
  });
});
// ----------------------
//  PUT /inventory/:id/photo — оновлення фото
// ----------------------
app.put('/inventory/:id/photo', upload.single('photo'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(x => x.id === id);

  if (!item) {
    return res.status(404).json({ error: "Річ з таким ID не знайдена" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Фото не завантажено" });
  }

  // Нове ім'я файлу
  item.photo = req.file.filename;

  res.status(200).json({
    message: "Фото успішно оновлено",
    item
  });
});
// ----------------------
//  GET /inventory/:id/photo — повернення фото речі
// ----------------------
app.get('/inventory/:id/photo', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(x => x.id === id);

  if (!item) {
    return res.status(404).json({ error: "Річ з таким ID не знайдена" });
  }

  if (!item.photo) {
    return res.status(404).json({ error: "Фото для цієї речі не існує" });
  }

  const filePath = path.join(cacheDir, item.photo); // НЕ АБСОЛЮТНИЙ

  try {
    await fs.access(filePath); // перевірка існування
  } catch (err) {
    return res.status(404).json({ error: "Фото-файл не знайдено" });
  }

  // 🔥 ВАЖЛИВО: використовуємо абсолютний шлях
  res.sendFile(path.resolve(filePath));
});
// ----------------------
//  DELETE /inventory/:id — видалення речі
// ----------------------
app.delete('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);

  const index = inventory.findIndex(x => x.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Річ з таким ID не існує" });
  }

  const deletedItem = inventory[index];

  // Видаляємо з масиву
  inventory.splice(index, 1);

  res.status(200).json({
    message: "Річ успішно видалено",
    deleted: deletedItem
  });
});
app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.resolve("RegisterForm.html"));
});
app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.resolve("SearchForm.html"));
});
// ----------------------
//  POST /search — пошук речі за ID з форми
// ----------------------
app.post('/search', (req, res) => {
  const { id, has_photo } = req.body;

  const itemId = parseInt(id, 10);

  const item = inventory.find(x => x.id === itemId);

  if (!item) {
    return res.status(404).json({ error: "Річ з таким ID не знайдена" });
  }

  // Базова відповідь
  const result = {
    id: item.id,
    name: item.name,
    description: item.description
  };

  // Якщо користувач поставив галочку — додаємо посилання на фото
  if (has_photo) {
    result.photo_url = item.photo ? `/inventory/${item.id}/photo` : null;
  }

  res.status(200).json(result);
});
app.use((req, res, next) => {
  const path = req.route ? req.route.path : req.path;

  const allowed = allowedRoutes[path];

  if (allowed) {
    // Маршрут існує, але метод не дозволений
    if (!allowed.includes(req.method)) {
      return res.status(405).json({ error: "Method Not Allowed" });
    }
  }

  // Якщо маршрут взагалі не існує → 404
  return res.status(404).json({ error: "Not Found" });
});




