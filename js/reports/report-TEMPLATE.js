// report-TEMPLATE.js
// Copy this file and rename it with the next sequential number (e.g., report-002.js)
// Then add the filepath to reports-loader.js at the TOP of the reportFiles array

window.currentReport = {
  title: "Report [NUMBER] — [Your Title Here]",
  date: "[Date or Week]",
  content: `
<p>
  Your report content goes here. You can use HTML formatting:
</p>

<ul>
  <li>Bullet points</li>
  <li>More bullet points</li>
</ul>

<h3>Section Heading</h3>

<p>
  More paragraphs here. You can include <strong>bold text</strong>, 
  <em>italic text</em>, and <a href="#">links</a>.
</p>

<p>
  Example of including an image:
  <img src="assets/images/your-image.png" alt="Description" style="max-width: 100%; height: auto;">
</p>

<h3>Another Section</h3>

<p>Keep writing your report...</p>

<blockquote style="border-left: 3px solid #ccc; padding-left: 1rem; color: #666;">
  You can also use blockquotes for important callouts or quotes.
</blockquote>
`
};

// INSTRUCTIONS FOR ADDING A NEW REPORT:
// 1. Copy this file
// 2. Rename it: report-002.js (or next number)
// 3. Edit the title, date, and content above
// 4. Save the file in your js/reports/ folder
// 5. Open reports-loader.js
// 6. Add your new file to the TOP of the reportFiles array:
//    "js/reports/report-002.js",
// 7. Commit and push to GitHub
// 8. Your new report will appear at the top of the Reports page!
