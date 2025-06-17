document.addEventListener("DOMContentLoaded", async () => {
    const wordsContainer = document.getElementById("word-list");
    const alphabetNav = document.getElementById("alphabet-nav");
    const searchInput = document.getElementById("searchInput");
    const addWordBtn = document.getElementById("addWordBtn");

    // Создаём алфавитный указатель
    const alphabet = "АБВГДЕЖЗИЙКЛМНҢОӨПРСТУҮФХЦЧШЩЫЭЮЯ".split("");
    alphabetNav.innerHTML = alphabet
        .map(letter => `<span class="alphabet-letter" data-letter="${letter}">${letter}</span>`)
        .join(" ");

    let allWords = [];

    // Проверяем, является ли пользователь админом
    async function checkAdmin() {
        const token = localStorage.getItem("token");
        console.log("Отправляем токен:", token); // <-- Логируем токен
    
        if (!token) {
            addWordBtn.style.display = "none";
            localStorage.removeItem("isAdmin");
            return;
        }
    
        try {
            const response = await fetch("http://localhost:5000/check-admin", {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
            });
    
            console.log("Ответ check-admin:", response.status); // <-- Логируем статус ответа
    
            if (response.ok) {
    addWordBtn.style.display = "block";
    localStorage.setItem("isAdmin", "true"); // <-- сохраняем флаг
} else {
    addWordBtn.style.display = "none";
    localStorage.removeItem("isAdmin"); // <-- удаляем флаг
}

        } catch (error) {
            console.error("Ошибка проверки админа:", error);
            addWordBtn.style.display = "none";
        }
    }
    
    

    // Загружаем слова из базы
    async function loadWords() {
        try {
            const response = await fetch("http://localhost:5000/words", { cache: "no-store" }); 
            console.log("Ответ сервера:", response);
            
            if (!response.ok) throw new Error("Ошибка загрузки слов");
    
            allWords = await response.json();
            console.log("Слова с сервера:", allWords);
    
            allWords.sort((a, b) => a.tuvian.localeCompare(b.tuvian, "ru"));
            renderWords(allWords);
        } catch (error) {
            console.error("Ошибка загрузки списка слов:", error);
        }
    }
    
    

    // Отображаем слова в алфавитном порядке
    function renderWords(words) {
    wordsContainer.innerHTML = "";

    const isAdmin = localStorage.getItem("isAdmin") === "true"; // ✅ Вынесли наверх

    const groupedWords = {};
    words.forEach(word => {
        const firstLetter = word.tuvian[0].toUpperCase();
        if (!groupedWords[firstLetter]) {
            groupedWords[firstLetter] = [];
        }
        groupedWords[firstLetter].push(word);
    });

    alphabet.forEach(letter => {
        if (groupedWords[letter]) {
            const section = document.createElement("div");
            section.innerHTML = `<h2 id="${letter}">${letter}</h2>` +
                groupedWords[letter]
                    .map(word => `
                        <p>
                            <a href="#" class="word-link" data-id="${word.id}">${word.tuvian}</a>
                            ${isAdmin ? `
                                <button class="edit-btn" data-id="${word.id}">✎</button>
                                <button class="delete-btn" data-id="${word.id}">🗑️</button>
                            ` : ""}
                        </p>
                    `).join("");
            wordsContainer.appendChild(section);
        }
    });
}

    

    // Фильтр поиска слов
    function filterWords() {
        const searchValue = searchInput.value.toLowerCase();
        const filteredWords = allWords.filter(word =>
            word.tuvian.toLowerCase().includes(searchValue)
        );
        renderWords(filteredWords);
    }

    // Навигация по алфавиту
    alphabetNav.addEventListener("click", (event) => {
        if (event.target.classList.contains("alphabet-letter")) {
            const letter = event.target.dataset.letter;
            const section = document.getElementById(letter);
            if (section) {
                section.scrollIntoView({ behavior: "smooth" });
            }
        }
    });

    searchInput.addEventListener("input", filterWords);

    await checkAdmin();
    await loadWords();
});
document.addEventListener("click", async (event) => {
    if (event.target.classList.contains("word-link")) {
        event.preventDefault();
        const wordId = event.target.getAttribute("data-id");
        await openWordModal(wordId);
    }
    if (event.target.classList.contains("delete-btn")) {
        const id = event.target.getAttribute("data-id");
        if (confirm("Удалить это слово?")) {
            try {
                const token = localStorage.getItem("token");
                const response = await fetch(`http://localhost:5000/words/${id}`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    alert("Слово удалено");
                    await loadWords(); // обновить список
                } else {
                    alert("Ошибка удаления");
                }
            } catch (error) {
                console.error("Ошибка удаления:", error);
                alert("Ошибка при удалении");
            }
        }
    }

    // Редактирование (можно заменить на открытие формы)
    if (event.target.classList.contains("edit-btn")) {
    const id = event.target.getAttribute("data-id");
    await openEditModal(id);
}

});




function closeWordModal() {
    document.getElementById("wordModal").style.display = "none";
}

async function openWordModal(wordId) {
    try {
        const response = await fetch(`http://localhost:5000/words/${wordId}/details`);
        if (!response.ok) throw new Error("Ошибка загрузки данных слова");

        const data = await response.json();
        console.log("Данные слова получены:", data);

        // Получаем формы, глаголы и прилагательные
        const baseForms = Array.isArray(data.forms) ? data.forms : [];
        const verbs = Array.isArray(data.verbs) ? data.verbs : [];
        const adjectives = Array.isArray(data.adjectives) ? data.adjectives : [];
        const synonyms = Array.isArray(data.synonyms) ? data.synonyms : [];

        // Объединяем всё в один массив с указанием типа
        const forms = [
            ...baseForms.map(f => ({ ...f, case_name: f.case_name })),
            ...verbs.map(v => ({ ...v, case_name: "глагол" })),
            ...adjectives.map(a => ({ ...a, case_name: "прилагательное" }))
        ];

        // 🔍 определение типа формы
        function detectType(form) {
            const name = (form.case_name || '').toLowerCase();
            if (name.includes('глагол')) return 'verb';
            if (name.includes('прилаг')) return 'adj';
            if (name.includes('другое') || name.includes('форма')) return 'other';
            return 'case';
        }

        const caseOrder = [
            "Адаарының",
            "Хамаарыштырарының",
            "Бээриниң",
            "Онаарының",
            "Турарының",
            "Үнериниң",
            "Углаарының"
        ];

        const casesSingular = forms
            .filter(f => detectType(f) === 'case' && !f.plural)
            .sort((a, b) => caseOrder.indexOf(a.case_name) - caseOrder.indexOf(b.case_name));

        const casesPlural = forms
            .filter(f => detectType(f) === 'case' && f.plural)
            .sort((a, b) => caseOrder.indexOf(a.case_name) - caseOrder.indexOf(b.case_name));

        const verbsFromForms = forms.filter(f => detectType(f) === 'verb');
        const adjectivesFromForms = forms.filter(f => detectType(f) === 'adj');

        // ✅ Создание HTML
        let modalContent = `
        <button class="close-button" onclick="closeWordModal()">×</button>
        <h2>Формы слова</h2>

        <div>
            <h3>Падежи</h3>
            <div style="display: flex; gap: 40px;">
                <div>
                    <h4>Единственное число</h4>
                    ${casesSingular.map(f => `<p>${f.case_name}: ${f.form}</p>`).join('') || '<p>—</p>'}
                </div>
                <div>
                    <h4>Множественное число</h4>
                    ${casesPlural.map(f => `<p>${f.case_name}: ${f.form}</p>`).join('') || '<p>—</p>'}
                </div>
            </div>
        </div>

        <div style="margin-top: 20px;">
            <h3>Глаголы</h3>
            <div style="display: flex; gap: 40px;">
                <div>
                    <h4>Единственное число</h4>
                    ${verbsFromForms.filter(f => !f.plural).map(f => `<p>${f.form}</p>`).join('') || '<p>—</p>'}
                </div>
                <div>
                    <h4>Множественное число</h4>
                    ${verbsFromForms.filter(f => f.plural).map(f => `<p>${f.form}</p>`).join('') || '<p>—</p>'}
                </div>
            </div>
        </div>

        <div style="margin-top: 20px;">
            <h3>Прилагательные</h3>
            <div style="display: flex; gap: 40px;">
                <div>
                    <h4>Единственное число</h4>
                    ${adjectivesFromForms.filter(f => !f.plural).map(f => `<p>${f.form}</p>`).join('') || '<p>—</p>'}
                </div>
                <div>
                    <h4>Множественное число</h4>
                    ${adjectivesFromForms.filter(f => f.plural).map(f => `<p>${f.form}</p>`).join('') || '<p>—</p>'}
                </div>
            </div>
        </div>

        ${synonyms.length > 0 ? `
            <div style="margin-top: 20px;">
                <h3>Остальное (синонимы)</h3>
                <ul>${synonyms.map(s => `<li>${s}</li>`).join('')}</ul>
            </div>` : ''}
        `;

        document.getElementById("modal-content").innerHTML = modalContent;
        document.getElementById("wordModal").style.display = "block";
    } catch (error) {
        console.error("Ошибка загрузки форм слова:", error);
    }
}

async function openEditModal(wordId) {
    try {
        const response = await fetch(`http://localhost:5000/words/${wordId}/details`);
        if (!response.ok) throw new Error("Ошибка загрузки данных слова");

        const data = await response.json();
        const word = data.word || {};
        const baseForms = Array.isArray(data.forms) ? data.forms : [];
        const verbs = Array.isArray(data.verbs) ? data.verbs : [];
        const adjectives = Array.isArray(data.adjectives) ? data.adjectives : [];
        const synonyms = Array.isArray(data.synonyms) ? data.synonyms : [];

const forms = [
    ...baseForms.map(f => ({ ...f, case_name: f.case_name })),
    ...verbs.map(v => ({ ...v, case_name: 'глагол' })),
    ...adjectives.map(a => ({ ...a, case_name: 'прилагательное' }))
];


        let modalContent = `
    <button class="close-button" onclick="closeWordModal()">×</button>
    <h2>Редактировать слово</h2>
    <input type="hidden" id="edit-word-id" value="${wordId}" />
    <label>Базовая форма:</label>
    <input type="text" id="editBaseForm" value="${word.tuvian || ''}" />
    
    <label>Комментарий:</label>
    <input type="text" id="editComment" value="${word.comment || ''}" />
    
    <label>Синонимы (через запятую):</label>
    <input type="text" id="editSynonyms" value="${synonyms.join(', ')}" />

    <h3>Формы слова</h3>
    <div id="edit-forms-container">
        ${forms.map(f => `
            <div class="form-group">
                <input type="text" class="case-name" value="${f.case_name || ''}" placeholder="Падеж / Тип" />
                <input type="text" class="case-form" value="${f.form || ''}" placeholder="Форма слова" />
                <label>
                    <input type="checkbox" class="case-plural" ${f.plural ? "checked" : ""} /> Мн. число
                </label>
            </div>
        `).join("")}
    </div>
    <button onclick="saveWordChanges()">💾 Сохранить</button>
`;


        document.getElementById("modal-content").innerHTML = modalContent;
        document.getElementById("wordModal").style.display = "block";
    } catch (err) {
        console.error("Ошибка открытия формы редактирования:", err);
    }
}
async function saveWordChanges() {
    const wordId = document.getElementById("edit-word-id").value;
    const tuvian = document.getElementById("editBaseForm").value.trim(); // ← это теперь правильно
    const comment = document.getElementById("editComment").value.trim();
    const synonyms = document.getElementById("editSynonyms").value
        .split(",")
        .map(s => s.trim())
        .filter(s => s);

    const forms = [];
const adjectives = [];
const verbs = [];

document.querySelectorAll("#edit-forms-container .form-group").forEach(row => {
    const caseValue = row.querySelector(".case-name").value.trim();
    const formValue = row.querySelector(".case-form").value.trim();
    const plural = row.querySelector(".case-plural").checked;

    if (caseValue && formValue) {
        const lower = caseValue.toLowerCase();
        if (lower.includes("прилаг")) {
            adjectives.push({ form: formValue, plural });
        } else if (lower.includes("глагол")) {
            verbs.push({ form: formValue, plural });
        } else {
            forms.push({ case_name: caseValue, form: formValue, plural });
        }
    }
});


    const data = { tuvian, comment, synonyms, forms, adjectives, verbs };


    try {
        const token = localStorage.getItem("token");
        const response = await fetch(`http://localhost:5000/words/${wordId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert("Слово обновлено");
            closeWordModal();
            await loadWords();
        } else {
            alert("Ошибка при обновлении слова");
        }
    } catch (error) {
        console.error("Ошибка при сохранении:", error);
        alert("Ошибка при сохранении слова");
    }
}








    

