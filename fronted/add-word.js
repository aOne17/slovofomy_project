document.getElementById("add-word-form").addEventListener("submit", function (event) {
    event.preventDefault(); // Предотвращаем перезагрузку страницы

    const tuvian = document.getElementById("tuvian").value;
    const comment = document.getElementById("comment").value;
    const token = localStorage.getItem("token");
    <link rel="stylesheet" href="styles.css"></link>
    if (!token) {
        alert("Вы не авторизованы!");
        return;
    }

    fetch("http://localhost:5000/add-word", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ tuvian, comment })
    })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            document.getElementById("add-word-form").reset(); // Очищаем форму
        })
        .catch(error => console.error("Ошибка:", error));
});
