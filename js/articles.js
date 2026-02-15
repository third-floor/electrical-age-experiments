fetch("assets/data/articles.json")
  .then(response => response.json())
  .then(data => {
    const tbody = document.querySelector("#articlesTable tbody");

    data.forEach(article => {
      const tr = document.createElement("tr");

      // Add class based on article type for styling
      tr.className = article.article_type === "advertisement" ? "ad-row" : "article-row";

      tr.innerHTML = `
        <td>${article.article_title || ""}</td>
        <td><span class="badge badge-${article.article_type}">${article.article_type || ""}</span></td>
        <td>${article.page_number || ""}</td>
        <td>${article.filename || ""}</td>
      `;

      tbody.appendChild(tr);
    });

    // Search filter
    document.getElementById("searchBox").addEventListener("keyup", e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll("#articlesTable tbody tr").forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });

    // Filter by type
    document.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const filter = btn.dataset.filter;
        
        // Update active button
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        // Filter rows
        document.querySelectorAll("#articlesTable tbody tr").forEach(tr => {
          if (filter === "all") {
            tr.style.display = "";
          } else if (filter === "articles") {
            tr.style.display = tr.classList.contains("article-row") ? "" : "none";
          } else if (filter === "advertisements") {
            tr.style.display = tr.classList.contains("ad-row") ? "" : "none";
          }
        });
      });
    });

    // Add sorting functionality
    document.querySelectorAll("#articlesTable th").forEach((th, index) => {
      th.addEventListener("click", () => {
        const table = document.getElementById("articlesTable");
        const rows = Array.from(tbody.querySelectorAll("tr"));
        const isAscending = th.classList.contains("sort-asc");
        
        // Clear all sort classes
        document.querySelectorAll("#articlesTable th").forEach(header => {
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

    // Display stats
    const totalArticles = data.filter(a => a.article_type === "article").length;
    const totalAds = data.filter(a => a.article_type === "advertisement").length;
    document.getElementById("stats").innerHTML = `
      <strong>Total:</strong> ${data.length} entries | 
      <strong>Articles:</strong> ${totalArticles} | 
      <strong>Advertisements:</strong> ${totalAds}
    `;
  })
  .catch(err => {
    console.error("Failed to load articles.json", err);
  });
