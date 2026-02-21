document.getElementById("bidForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    
    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const date = document.getElementById("date").value;
    const amount = document.getElementById("bidAmount").value;
    const hoursPerDay = document.getElementById("adHours").value;
    
    // Ensure bid amount is above ₹5000
    if (amount < 5000) {
        document.getElementById("bidMessage").textContent = "Bid amount must be at least ₹5000.";
        return;
    }

    const response = await fetch("http://localhost:5000/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, amount, hoursPerDay, date })
    });
    
    const data = await response.json();

    // Display the result message
    if (data.message) {
        document.getElementById("bidMessage").textContent = data.message;
    } else {
        document.getElementById("bidMessage").textContent = "Error: Something went wrong.";
    }
});
