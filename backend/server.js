require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());

const SECRET_KEY = process.env.JWT_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SECRET_KEY || !ADMIN_PASSWORD) {
    console.error("❌ Ошибка: Не заданы JWT_SECRET или ADMIN_PASSWORD в .env");
    process.exit(1);
}

//  Подключение к БД
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
});

pool.connect()
    .then(() => console.log("✅ Подключение к базе данных установлено."))
    .catch(err => {
        console.error("❌ Ошибка подключения к базе данных:", err);
        process.exit(1);
    });

//  Middleware проверки токена
const authMiddleware = (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Нет доступа (токен отсутствует)" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: "Нет прав администратора" });
        }
        next();
    } catch (err) {
        console.error("❌ Ошибка верификации токена:", err.message);
        return res.status(401).json({ message: "Неверный токен" });
    }
};

app.get("/check-admin", (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Нет токена" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.isAdmin) {
            return res.sendStatus(200);
        } else {
            return res.sendStatus(403);
        }
    } catch (error) {
        return res.status(401).json({ message: "Неверный токен" });
    }
});






//  Вход (только пароль администратора)
app.post("/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = jwt.sign({ isAdmin: true }, SECRET_KEY, { expiresIn: "7d" });
        res.json({ message: "Вы вошли как администратор!", token });
    } else {
        res.status(401).json({ message: "Неверный пароль" });
    }
});

//  Получение списка слов (в алфавитном порядке)
app.get("/words", async (req, res) => {
    try {
        const words = await pool.query("SELECT * FROM words ORDER BY tuvian ASC");
        res.json(words.rows);
    } catch (err) {
        console.error("Ошибка получения слов:", err);
        res.status(500).json({ message: "Ошибка сервера" });
    }
});

//  Добавление слова (только админ)
app.post("/add-word", authMiddleware, async (req, res) => {
    const { word, forms, synonyms } = req.body;

    try {
        if (!word || !forms || forms.length === 0) {
            return res.status(400).json({ message: "Ошибка: Заполните все поля!" });
        }

        const newWord = await pool.query(
            "INSERT INTO words (tuvian, synonyms) VALUES ($1, $2) RETURNING id",
            [word, Array.isArray(synonyms) ? synonyms : [synonyms]]
        );

        const wordId = newWord.rows[0].id;

        const validForms = forms.filter(f => f.case_name && f.form);

        if (validForms.length === 0) {
            return res.status(400).json({ message: "Ошибка: Все формы пустые или содержат ошибки!" });
        }

        console.log("Отправляем в БД:", validForms);

        const formQueries = validForms.map(f => {
            return pool.query(
                "INSERT INTO word_forms (word_id, case_name, form, plural) VALUES ($1, $2, $3, $4)",
                [wordId, f.case_name, f.form, f.plural ?? false]
            );
        });

        await Promise.all(formQueries);

        res.json({ message: "Слово успешно добавлено!" });
    } catch (error) {
        console.error("Ошибка при добавлении слова:", error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
});
//  Получение форм слова по ID слова
app.get("/words/:id/details", async (req, res) => {
    const wordId = req.params.id;

    try {
        const wordQuery = "SELECT * FROM words WHERE id = $1";
        const formsQuery = "SELECT id, word_id, case_name, form, plural FROM word_forms WHERE word_id = $1";
        const adjectivesQuery = "SELECT id, word_id, form, plural FROM adjectives WHERE word_id = $1";
        const verbsQuery = "SELECT id, word_id, form, plural FROM verbs WHERE word_id = $1";

        const [wordResult, formsResult, adjectivesResult, verbsResult] = await Promise.all([
            pool.query(wordQuery, [wordId]),
            pool.query(formsQuery, [wordId]),
            pool.query(adjectivesQuery, [wordId]),
            pool.query(verbsQuery, [wordId]),
        ]);

        if (wordResult.rows.length === 0) {
            return res.status(404).json({ error: "Слово не найдено" });
        }

        const word = wordResult.rows[0];

        res.json({
            id: word.id,
            tuvian: word.tuvian,
            comment: word.comment,
            synonyms: word.synonyms || [],
            forms: formsResult.rows,
            adjectives: adjectivesResult.rows,
            verbs: verbsResult.rows
        });
    } catch (error) {
        console.error("Ошибка при получении деталей слова:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});
app.post("/add-word", authMiddleware, async (req, res) => {
    const { word, forms, adjectives, verbs, synonyms } = req.body;

    try {
        if (!word || !forms || forms.length === 0) {
            return res.status(400).json({ message: "Ошибка: Заполните все обязательные поля!" });
        }

        // Добавляем слово
        const newWord = await pool.query(
            "INSERT INTO words (tuvian, synonyms) VALUES ($1, $2) RETURNING id",
            [word, Array.isArray(synonyms) ? synonyms : [synonyms]]
        );

        const wordId = newWord.rows[0].id;

        // Фильтруем падежи
        const validForms = forms.filter(f => f.case_name && f.form);
        if (validForms.length > 0) {
            const formQueries = validForms.map(f => {
                return pool.query(
                    "INSERT INTO word_forms (word_id, case_name, form, plural) VALUES ($1, $2, $3, $4)",
                    [wordId, f.case_name, f.form, f.plural ?? false]
                );
            });
            await Promise.all(formQueries);
        }

        // Фильтруем прилагательные
        if (Array.isArray(adjectives)) {
            const adjectiveQueries = adjectives
                .filter(adj => adj.form)
                .map(adj => {
                    return pool.query(
                        "INSERT INTO adjectives (word_id, form, plural) VALUES ($1, $2, $3)",
                        [wordId, adj.form, adj.plural ?? false]
                    );
                });
            await Promise.all(adjectiveQueries);
        }

        // Фильтруем глаголы
        if (Array.isArray(verbs)) {
            const verbQueries = verbs
                .filter(v => v.form)
                .map(v => {
                    return pool.query(
                        "INSERT INTO verbs (word_id, form, plural) VALUES ($1, $2, $3)",
                        [wordId, v.form, v.plural ?? false]
                    );
                });
            await Promise.all(verbQueries);
        }

        res.json({ message: "Слово успешно добавлено!" });
    } catch (error) {
        console.error("Ошибка при добавлении слова:", error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
});
app.delete("/words/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;

    try {
        // Удаляем формы (если ты не используешь cases_singular / plural — можешь убрать эти строки)
        await pool.query("DELETE FROM word_forms WHERE word_id = $1", [id]);
        await pool.query("DELETE FROM cases_singular WHERE word_id = $1", [id]);
        await pool.query("DELETE FROM cases_plural WHERE word_id = $1", [id]);
        await pool.query("DELETE FROM adjectives WHERE word_id = $1", [id]);
        await pool.query("DELETE FROM verbs WHERE word_id = $1", [id]);

        // Удаляем основное слово
        await pool.query("DELETE FROM words WHERE id = $1", [id]);

        res.status(200).json({ message: "Слово удалено" });
    } catch (err) {
        console.error("Ошибка при удалении слова:", err);
        res.status(500).json({ message: "Ошибка сервера при удалении" });
    }
});
app.put("/words/:id", authMiddleware, async (req, res) => {
    const id = req.params.id;
    const { tuvian, comment, synonyms, forms, adjectives, verbs } = req.body;

    try {
        // 1. Обновляем базовую информацию
        await pool.query(
            "UPDATE words SET tuvian = $1, comment = $2, synonyms = $3 WHERE id = $4",
            [tuvian, comment, synonyms, id]
        );

        // 2. Удаляем старые формы
        await pool.query("DELETE FROM word_forms WHERE word_id = $1", [id]);
        await pool.query("DELETE FROM adjectives WHERE word_id = $1", [id]);
        await pool.query("DELETE FROM verbs WHERE word_id = $1", [id]);

        // 3. Добавляем новые формы
        if (Array.isArray(forms)) {
            for (const f of forms) {
                await pool.query(
                    "INSERT INTO word_forms (word_id, case_name, form, plural) VALUES ($1, $2, $3, $4)",
                    [id, f.case_name, f.form, f.plural ?? false]
                );
            }
        }

        // 4. Добавляем прилагательные
        if (Array.isArray(adjectives)) {
            for (const adj of adjectives) {
                await pool.query(
                    "INSERT INTO adjectives (word_id, form, plural) VALUES ($1, $2, $3)",
                    [id, adj.form, adj.plural ?? false]
                );
            }
        }

        // 5. Добавляем глаголы
        if (Array.isArray(verbs)) {
            for (const verb of verbs) {
                await pool.query(
                    "INSERT INTO verbs (word_id, form, plural) VALUES ($1, $2, $3)",
                    [id, verb.form, verb.plural ?? false]
                );
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("Ошибка при обновлении слова:", err);
        res.status(500).json({ error: "Ошибка сервера при обновлении" });
    }
});





//  Главная страница (статус сервера)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../fronted/index.html"));
});

//  Раздача статических файлов 
app.use(express.static(path.join(__dirname, "../fronted")));

//  Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});






