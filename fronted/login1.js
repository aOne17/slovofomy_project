document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const errorMessage = document.getElementById("error-message");

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const password = document.getElementById("password").value;
        
        try {
            const response = await fetch("http://localhost:5000/login", {
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
        } catch (error) {
            errorMessage.textContent = "Ошибка соединения с сервером.";
        }
    });
});
