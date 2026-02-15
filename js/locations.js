fetch("assets/data/locations.json")
  .then(response => response.text())  // Get as text first
  .then(text => {
    // Replace NaN with null to make valid JSON
    const cleanedText = text.replace(/:\s*NaN\s*([,\}])/g, ': null$1');
    return JSON.parse(cleanedText);
  })
  .then(data => {
    const tbody = document.querySelector("#locationsTable tbody");

    data.forEach(location => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${location.location_entry || ""}</td>
        <td>${location.location_standardised || ""}</td>
        <td>${location.brief_context || ""}</td>
        <td>${location.article_title || ""}</td>
        <td>${location.page_number || ""}</td>
        <td>${location.filename || ""}</td>
        <td><details><summary>View extract</summary><p style="margin: 0.5rem 0; max-width: 400px; line-height: 1.4;">${location.brief_extract || ""}</p></details></td>
      `;

      tbody.appendChild(tr);
    });

    // Search filter
    document.getElementById("searchBox").addEventListener("keyup", e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll("#locationsTable tbody tr").forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });

    // Add sorting functionality
    document.querySelectorAll("#locationsTable th").forEach((th, index) => {
      th.addEventListener("click", () => {
        const table = document.getElementById("locationsTable");
        const rows = Array.from(tbody.querySelectorAll("tr"));
        const isAscending = th.classList.contains("sort-asc");
        
        // Clear all sort classes
        document.querySelectorAll("#locationsTable th").forEach(header => {
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
    console.error("Failed to load locations.json", err);
    document.querySelector("#locationsTable tbody").innerHTML = 
      '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #999;">Failed to load locations data. Please check the console for details.</td></tr>';
  });
