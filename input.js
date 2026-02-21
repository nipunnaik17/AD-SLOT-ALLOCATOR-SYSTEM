
document.getElementById("signupForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const company_name = document.getElementById("fname").value;
    const username = document.getElementById("fname").value; 
    const email = document.getElementById("email").value;
    const password = document.getElementById("pass").value;
    const mobile = document.getElementById("mobile").value;
    const gstin = document.getElementById("id").value;

    const response = await fetch("http://localhost:5000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name, username, email, password, mobile, gstin })
    });

    const data = await response.json();
    alert(data.message);
    if (response.ok) window.location.href = "login.html";
});