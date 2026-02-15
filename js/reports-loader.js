// reports-loader.js
// This file loads all individual report files and displays them in reverse chronological order

// List of report files to load (add new reports to the TOP of this array)
const reportFiles = [
  "js/reports/report-001.js",  // Most recent report goes here
  // Add new reports here as: "js/reports/report-002.js",
  // Format: report-XXX.js where XXX is a sequential number
];

const container = document.getElementById("reports-container");

// Clear loading message
container.innerHTML = "";

// Function to load a single report file
function loadReport(filepath) {
  return fetch(filepath)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load ${filepath}`);
      }
      return response.text();
    })
    .then(scriptText => {
      // Execute the script to define the report variable
      const script = document.createElement('script');
      script.textContent = scriptText;
      document.body.appendChild(script);
      
      // Get the report that was just defined
      const report = window.currentReport;
      
      // Clean up
      delete window.currentReport;
      document.body.removeChild(script);
      
      return report;
    })
    .catch(err => {
      console.error(`Error loading ${filepath}:`, err);
      return null;
    });
}

// Load all reports in order
Promise.all(reportFiles.map(loadReport))
  .then(reports => {
    // Filter out any failed loads
    const validReports = reports.filter(r => r !== null);
    
    if (validReports.length === 0) {
      container.innerHTML = "<p style='text-align: center; color: #999;'>No reports available yet.</p>";
      return;
    }
    
    // Display each report
    validReports.forEach(report => {
      const section = document.createElement("section");
      section.className = "report";
      
      section.innerHTML = `
        <h2>${report.title}</h2>
        <div class="meta">${report.date}</div>
        ${report.content}
      `;
      
      container.appendChild(section);
    });
  })
  .catch(err => {
    console.error("Error loading reports:", err);
    container.innerHTML = "<p style='text-align: center; color: red;'>Failed to load reports. Please refresh the page.</p>";
  });
