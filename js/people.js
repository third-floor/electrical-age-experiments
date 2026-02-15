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
        <td>${person.article_title || ""}</td>
        <td>${person.page_number || ""}</td>
        <td>${person.filename || ""}</td>
        <td><details><summary>View extract</summary><p style="margin: 0.5rem 0; max-width: 400px; line-height: 1.4;">${person.brief_extract || ""}</p></details></td>
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

    // Add sorting functionality
    document.querySelectorAll("#peopleTable th").forEach((th, index) => {
      th.addEventListener("click", () => {
        const table = document.getElementById("peopleTable");
        const rows = Array.from(tbody.querySelectorAll("tr"));
        const isAscending = th.classList.contains("sort-asc");
        
        // Clear all sort classes
        document.querySelectorAll("#peopleTable th").forEach(header => {
          header.classList.remove("sort-asc", "sort-desc");
        });
        
        // Sort rows
        rows.sort((a, b) => {
          const aText = a.cells[index].textContent.trim();
          const bText = b.cells[index].textContent.trim();
          
          if (isAscending) {
            return bText.localeCompare(aText);
          } else {
            return aText.localeCompare(bText);
          }
        });
        
        // Apply sort class
        th.classList.add(isAscending ? "sort-desc" : "sort-asc");
        
        // Re-append sorted rows
        rows.forEach(row => tbody.appendChild(row));
      });
    });
  })
  .catch(err => {
    console.error("Failed to load persons.json", err);
  });
