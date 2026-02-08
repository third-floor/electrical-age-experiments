const reports = [
  {
    title: "Report 1 – Identifying Persons and Locations with LLMs",
    date: "2026",
    content: `
<p>We are initially focusing on two areas of work:</p>
<ul>
  <li>Identifying all the persons mentioned in the texts</li>
  <li>Identifying all the locations mentioned in the texts</li>
</ul>

<p>During the Congruence Engine Project we already showed that while simple
Named Entity Recognition (NER) tools can be used to identify names,
they lack the ability to carry out additional refining and
standardising tasks.</p>

<p>Because of that, my proposed method has been to use the NER capabilities
of Large Language Models. My preference here is to initially test the
capabilities of Gemini, though I would like to expand the work to compare
the performance of other models too.</p>

<h3>Identifying persons</h3>

<p>The aim of identifying persons is three-fold. First, to have a better
understanding of who are the people mentioned and represented within the
volumes of the Electrical Age.</p>

<p>Second, a complete list of the people mentioned will make the journal
more accessible to users by giving them the ability to check whether the
person they are looking for is mentioned in the journal at all.</p>

<p>Third, these pages frequently include photographs of the people
mentioned. By identifying all instances of such photographs, we can
create a gallery of women associated with the journal.</p>

<p>Two technical approaches were considered. A key decision was not to work
with already OCR-captured text, but rather to re-process the images
page-by-page, allowing the LLM to capture visual semantics.</p>

<p>Initial experiments compared Gemini and Claude Sonnet. While both
identified overlapping individuals, Gemini captured additional figures
missed by Claude and preserved textual order more reliably. For these
reasons, further testing continued with Gemini.</p>

<p>The final system embeds structured extraction instructions inside a
Python script deployed on Google Colab, producing both logs and
spreadsheets that record page-level transcriptions and identified
individuals.</p>
`
  }
];
