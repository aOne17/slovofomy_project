document.addEventListener("DOMContentLoaded", () => {
    const loginButton = document.getElementById("loginButton");
    const authButtons = document.getElementById("auth-buttons");
    const addWordButton = document.getElementById("addWordButton");
    const loginModal = document.getElementById("loginModal");
    const closeModal = document.querySelector(".close");
    const loginForm = document.getElementById("loginForm");
    const title = document.getElementById("site-title");
    const wordsContainer = document.getElementById("words-list");

    // Проверяем, есть ли токен (если да, скрываем "Войти" и показываем "Вы авторизованы")
    function checkAuth() {
        const token = localStorage.getItem("token");
        if (authButtons) {
            if (token) {
                authButtons.innerHTML = `
                    <span>Вы авторизованы</span>
                    <button id="logoutButton" class="admin-button">Выйти</button>
                `;
                const logoutButton = document.getElementById("logoutButton");
                if (logoutButton) {
                    logoutButton.addEventListener("click", logout);
                }
                if (addWordButton) {
                    addWordButton.style.display = "block"; // Показываем кнопку "Добавить слово"
                }
            } else {
                authButtons.innerHTML = `<a href="login.html" id="auth-buttons" class="admin-button">Войти</a>`;
                const loginButton = document.getElementById("loginButton");
                if (loginButton) {
                    loginButton.addEventListener("click", () => loginModal.style.display = "flex");
                }
                if (addWordButton) {
                    addWordButton.style.display = "none"; // Скрываем кнопку "Добавить слово"
                }
            }
        } else {
            console.error("Элемент с ID 'auth-buttons' не найден в DOM.");
        }
    }
    
    

    // Закрытие окна входа
    if (closeModal) {
        closeModal.addEventListener("click", () => {
            loginModal.style.display = "none";
        });
    }

    // Авторизация
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const password = document.getElementById("password").value;

            const response = await fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            });

            const data = await response.json();
            alert(data.message); // Показываем сообщение пользователю

            if (response.ok) {
                localStorage.setItem("token", data.token);
                window.location.href = "index.html"; // Переход на главную
            } else {
                errorMessage.textContent = "Ошибка: " + data.message;
            }
        });
    }

    // Выход из системы
    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("isAdmin");
        checkAuth();
        loadWords(); 
    }

    checkAuth();

    // Делаем заголовок кликабельным для загрузки списка слов
    if (title) {
        title.addEventListener("click", loadWords);
    }

    async function loadWords() {
        try {
            const response = await fetch("/words");
            if (!response.ok) throw new Error("Ошибка загрузки слов");

            const words = await response.json();
            wordsContainer.innerHTML = ""; // Очищаем контейнер
            words.forEach(word => {
                const wordItem = document.createElement("div");
                wordItem.textContent = word.tuvian;
                wordItem.classList.add("word-item");
                wordItem.addEventListener("click", () => openWordModal(word.id));
                wordsContainer.appendChild(wordItem);
            });
        } catch (error) {
            console.error("Ошибка загрузки списка слов:", error);
        }
    }

});