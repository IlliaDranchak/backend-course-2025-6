const express = require('express');
const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// --------------------------------------
//  ALLOWED ROUTES (для 405)
// --------------------------------------
const allowedRoutes = {
  "/register": ["POST"],
  "/inventory": ["GET"],
  "/inventory/:id": ["GET", "PUT", "DELETE"],
  "/inventory/:id/photo": ["GET", "PUT"],
  "/search": ["POST"],
  "/RegisterForm.html": ["GET"],
  "/SearchForm.html": ["GET"]
};

// --------------------------------------
//  CLI OPTIONS
// --------------------------------------
program
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера', parseInt)
  .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

program.parse();
const { host, port, cache: cacheDir } = program.opts();

// --------------------------------------
//  CREATE CACHE DIR
// --------------------------------------
(async () => {
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    console.log(`Кеш директорія готова: ${path.resolve(cacheDir)}`);
  } catch (err) {
    console.error('Помилка створення директорії кешу:', err);
    process.exit(1);
  }
})();

// --------------------------------------
//  MULTER CONFIG
// --------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, cacheDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// --------------------------------------
//  DATABASE
// --------------------------------------
let inventory = [];
let currentId = 1;

// --------------------------------------
//  EXPRESS INIT
// --------------------------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------
//  SWAGGER CONFIG
// --------------------------------------
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory API",
      version: "1.0.0",
      description: "Документація API до лабораторної роботи №6"
    },
    servers: [{ url: `http://${host}:${port}` }]
  },
  apis: ["./main.js"]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --------------------------------------
//  ROUTES WITH SWAGGER COMMENTS
// --------------------------------------

/**
 * @openapi
 * /:
 *   get:
 *     summary: Головна сторінка
 *     responses:
 *       200:
 *         description: Сервер працює
 */
app.get('/', (req, res) => {
  res.send('Частина 1 + Express готові. Можна переходити до ендпоінтів інвентаря.');
});

/**
 * @openapi
 * /register:
 *   post:
 *     summary: Реєстрація нового інвентаря
 *     tags: [Inventory]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Інвентар створено
 */
app.post('/register', upload.single('photo'), async (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name || inventory_name.trim() === "") {
    return res.status(400).json({ error: "Поле inventory_name є обов'язковим." });
  }

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

/**
 * @openapi
 * /inventory:
 *   get:
 *     summary: Отримати список всіх інвентарів
 *     tags: [Inventory]
 *     responses:
 *       200:
 *         description: Список інвентарів
 */
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

/**
 * @openapi
 * /inventory/{id}:
 *   get:
 *     summary: Отримати інвентар за ID
 *     tags: [Inventory]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID інвентаря
 *     responses:
 *       200:
 *         description: Дані інвентаря
 *       404:
 *         description: Річ не знайдена
 */

app.get('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);

  const item = inventory.find(x => x.id === id);

  if (!item) return res.status(404).json({ error: "Річ з таким ID не знайдена" });

  res.status(200).json({
    id: item.id,
    name: item.name,
    description: item.description,
    photo: item.photo,
    photo_url: item.photo ? `/inventory/${item.id}/photo` : null
  });
});

/**
 * @openapi
 * /inventory/{id}:
 *   put:
 *     summary: Оновити дані інвентаря
 *     tags: [Inventory]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Нове ім'я
 *               description:
 *                 type: string
 *                 example: Оновлений опис
 *     responses:
 *       200:
 *         description: Дані оновлено
 */

app.put('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(x => x.id === id);

  if (!item) return res.status(404).json({ error: "Річ з таким ID не знайдена" });

  const { name, description } = req.body;

  if (name !== undefined) item.name = name;
  if (description !== undefined) item.description = description;

  res.status(200).json({ message: "Дані успішно оновлено", item });
});

/**
 * @openapi
 * /inventory/{id}/photo:
 *   put:
 *     summary: Оновити фото інвентаря
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID інвентаря
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Фото оновлено
 *       400:
 *         description: Фото не завантажено
 *       404:
 *         description: Речі з таким ID не знайдено
 */

app.put('/inventory/:id/photo', upload.single('photo'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(x => x.id === id);

  if (!item) return res.status(404).json({ error: "Річ з таким ID не знайдена" });
  if (!req.file) return res.status(400).json({ error: "Фото не завантажено" });

  item.photo = req.file.filename;

  res.status(200).json({ message: "Фото успішно оновлено", item });
});

/**
 * @openapi
 * /inventory/{id}/photo:
 *   get:
 *     summary: Отримати фото інвентаря
 *     tags: [Inventory]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Зображення повертається як файл
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Фото не знайдено
 */

app.get('/inventory/:id/photo', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = inventory.find(x => x.id === id);

  if (!item) return res.status(404).json({ error: "Річ з таким ID не знайдена" });
  if (!item.photo) return res.status(404).json({ error: "Фото для цієї речі не існує" });

  const filePath = path.join(cacheDir, item.photo);

  try {
    await fs.access(filePath);
  } catch {
    return res.status(404).json({ error: "Фото-файл не знайдено" });
  }

  res.sendFile(path.resolve(filePath));
});

/**
 * @openapi
 * /inventory/{id}:
 *   delete:
 *     summary: Видалити інвентар
 *     tags: [Inventory]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID інвентаря
 *     responses:
 *       200:
 *         description: Річ успішно видалено
 *       404:
 *         description: Річ з таким ID не існує
 */
app.delete('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);

  const index = inventory.findIndex(x => x.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Річ з таким ID не існує" });
  }

  const deletedItem = inventory[index];
  inventory.splice(index, 1);

  res.status(200).json({
    message: "Річ успішно видалено",
    deleted: deletedItem
  });
});


// --------------------------------------
//  HTML FILES
// --------------------------------------
app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.resolve("RegisterForm.html"));
});

app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.resolve("SearchForm.html"));
});

/**
 * @openapi
 * /search:
 *   post:
 *     summary: Пошук інвентаря за ID
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 1
 *               has_photo:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Результат пошуку
 *       404:
 *         description: Річ не знайдено
 */

app.post('/search', (req, res) => {
  const { id, has_photo } = req.body;

  const itemId = parseInt(id, 10);
  const item = inventory.find(x => x.id === itemId);

  if (!item) return res.status(404).json({ error: "Річ з таким ID не знайдена" });

  const result = {
    id: item.id,
    name: item.name,
    description: item.description
  };

  if (has_photo) {
    result.photo_url = item.photo ? `/inventory/${item.id}/photo` : null;
  }

  res.status(200).json(result);
});

// --------------------------------------
//  405 + 404 HANDLER
// --------------------------------------
app.use((req, res, next) => {
  const pathReq = req.route ? req.route.path : req.path;
  const allowed = allowedRoutes[pathReq];

  if (allowed && !allowed.includes(req.method)) {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  return res.status(404).json({ error: "Not Found" });
});

// --------------------------------------
//  SERVER START
// --------------------------------------
app.listen(port, host, () => {
  console.log(`Сервер Express запущено: http://${host}:${port}`);
});





