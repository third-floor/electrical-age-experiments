fetch("assets/data/persons.json")
  .then(response => response.json())
  .then(data => {
    const tbody = document.querySelector("#peopleTable tbody");

    data.forEach(person => {
      const tr = document.createElement("tr");

      // optional anchor for deep-linking
      if (person.id) tr.id = person.id;

      tr.innerHTML = `
        <td>${person.person_entry || ""}</td>
        <td>${person.standardised_name || ""}</td>
        <td>${person.title || ""}</td>
        <td>${person.role || ""}</td>
        <td>${person.associated_organisation || ""}</td>
        <td>${person.gender || ""}</td>
        <td>${person.relation || ""}</td>
        <td>${person.depicted || ""}</td>
        <td>${person.page_number || ""}</td>
        <td>${person.filename || ""}</td>
      `;

      tbody.appendChild(tr);
    });

    // Search filter
    document.getElementById("searchBox").addEventListener("keyup", e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll("#peopleTable tbody tr").forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
  })
  .catch(err => {
    console.error("Failed to load persons.json", err);
  });
