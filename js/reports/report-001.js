// report-001.js
// Report on Identifying Persons and Locations with LLMs

window.currentReport = {
  title: "Report on Identifying Persons and Locations with LLMs",
  date: "2026",
  content: `
<p>We are initially focusing on two areas of work:</p>
<ul>
  <li>Identifying all the persons mentioned in the texts</li>
  <li>Identifying all the locations mentioned in the texts</li>
</ul>

<p>During the Congruence Engine Project we already showed that while simple Named Entity Recognition (NER) tools can be used to identify names, they lack the ability to carry out additional refining/standardising tasks. Because of that, my proposed method has been to use the NER capabilities of Large Language Models. My preference here is to initially test the capabilities of Gemini, though I would like to expand the work to compare the performance of other models too. Both Claude and OpenAI's GPT models are useful to compare here as they form the basis of Microsoft's Copilot used by many organisations.</p>

<h3>Identifying persons</h3>

<p>The aim of identifying persons is three-fold. First, to have a better understanding of who are the people mentioned and represented within the volumes of the Electrical Age. Any such list, combined with the metadata related to the volumes are essential elements needed for any future analysis about the networks surrounding the journal and its connected organisations. Second, a complete list of the people mentioned will make the journal more accessible to users by giving them the ability to check whether the person they are looking for is mentioned in the journal at all. Third, the journal summaries of the activities of the various branches of the Electrical Association for Women. In addition, it also features descriptions of news articles related to women in engineering and science. These pages frequently include photographs of the people mentioned. By identifying all instances of such photographs, we can create a gallery of women associated with the journal to bring their visual histories to life again.</p>

<p>With these ideas in mind, two technical approaches were considered. A key decision was not to work with the already OCR captured text, but rather, to re-process the images of the pages page-by-page. While this is a costlier and more time-consuming process, it has the advantage of the LLM capturing the visual semantics of the page to derive the information, rather than just processing the text. This is essential for our need for accurately capturing all the photos that feature named individuals within the pages. [It is also worth mentioning here that for the first volume, I had to splice the pages into left and right as the images included both pages at the same time, that made the correct information extraction more complex and the processing more resource-heavy.]</p>

<p>The next consideration was to think about what elements to recapture from the text. The question and difficulty here is the extent to which we want to preserve the contextual complexity of the mention of a person. For example, do we want to preserve only the way in which the person was mentioned in the text, or do we want to also add a standardised name version? Do we want to include all the organisational associations with a person? Do we want to include the job/profession of a person if it is mentioned? Do we want to preserve the relation of the person to the text (e.g. author, quoted, subject etc.)?</p>

<p>I initially considered the right approach to be the creation of a complex JSON schema that guided the extraction of information. This was going to preserve the following items:</p>
<ul>
  <li>The filename (non-LLM captured)</li>
  <li>Page number in file (non-LLM captured)</li>
  <li>Page number on image (LLM captured)</li>
  <li>Title of article (LLM captured)</li>
  <li>Name of person as it appears in text (LLM captured)</li>
  <li>Extracted titled (e.g. Miss, Mrs, Mr, Lady, Dame etc.)</li>
  <li>Standardised name (LLM captured)</li>
  <li>Professional role mentioned (LLM captured)</li>
  <li>Organisation linked to the person (LLM captured)</li>
  <li>Predicted gender from text context (LLM captured)</li>
  <li>Relation to text (e.g. author, subject, quoted, member etc.) (LLM captured)</li>
  <li>Confidence level in information identification with specification why if not high level of confidence (LLM captured)</li>
</ul>

<p>I initially ran two initial tests on Gemini 3 and on Claude Sonnet 4.5. Below are the first from extracted entries from the same page.</p>

<p>Gemini 3 output:</p>
<pre>[
  {
    "pageNumberIdentified": 8,
    "articleColumnTitle": "Glasgow and District Branch.",
    "fullStringName": "The Lady Belhaven and Stenton",
    "honorificOrTitle": "The Lady",
    "nameStandardized": "Belhaven and Stenton",
    "jobTitleOrRole": "President",
    "associatedOrganization": "Glasgow and District Branch, E.A.W.",
    "predictedGenderFromContext": "female",
    "briefContext": "Author of the branch report and President of the Glasgow Branch; also depicted in a portrait.",
    "relationToText": "author",
    "confidenceLevel": "high"
  },
  {
    "pageNumberIdentified": 8,
    "articleColumnTitle": "Glasgow and District Branch.",
    "fullStringName": "THE LADY BELHAVEN AND STENTON",
    "honorificOrTitle": "THE LADY",
    "nameStandardized": "BELHAVEN AND STENTON",
    "jobTitleOrRole": "President",
    "associatedOrganization": "Glasgow and District Branch, E.A.W.",
    "predictedGenderFromContext": "female",
    "briefContext": "Portrait caption for the President of the Glasgow and District Branch.",
    "relationToText": "depicted in image",
    "confidenceLevel": "high"
  },
  {
    "pageNumberIdentified": 8,
    "articleColumnTitle": "Glasgow and District Branch.",
    "fullStringName": "Bailie W. B. Smith",
    "honorificOrTitle": "Bailie",
    "nameStandardized": "W. B. Smith",
    "jobTitleOrRole": "Chairman of the Smoke Abatement Committee",
    "associatedOrganization": "Smoke Abatement Committee, Glasgow",
    "predictedGenderFromContext": "male",
    "briefContext": "Spoke at the inaugural meeting in praise of the Association's objects.",
    "relationToText": "referenced/quoted",
    "confidenceLevel": "high"
  },</pre>

<p>Claude Sonnet 4.5 output:</p>
<pre>  {
    "fileName": "1926_page_8.png",
    "filePageNumber": 1,
    "pageNumberIdentified": "8",
    "articleColumnTitle": "E.A.W. Branch Activities - Glasgow and District Branch",
    "fullStringName": "The Lady Belhaven and Stenton",
    "honorificOrTitle": "Lady",
    "nameStandardized": "Belhaven and Stenton",
    "jobTitleOrRole": "Author/Branch correspondent",
    "associatedOrganization": "E.A.W. Glasgow and District Branch",
    "predictedGenderFromContext": "female",
    "briefContext": "Author of the Glasgow and District Branch report describing branch activities",
    "relationToText": "author",
    "confidenceLevel": "high"
  },
  {
    "fileName": "1926_page_8.png",
    "filePageNumber": 1,
    "pageNumberIdentified": "8",
    "articleColumnTitle": "E.A.W. Branch Activities - Glasgow and District Branch",
    "fullStringName": "Mr. Alexander Lindsay",
    "honorificOrTitle": "Mr.",
    "nameStandardized": "Alexander Lindsay",
    "jobTitleOrRole": "I.E.E. member/Lecturer",
    "associatedOrganization": "I.E.E.",
    "predictedGenderFromContext": "male",
    "briefContext": "Gave a talk on different forms of house wiring in a simple way",
    "relationToText": "referenced/quoted",
    "confidenceLevel": "high"
  },</pre>

<p>While both Gemini and Claude identified overlapping persons, Gemini 3 was also able to pick up additional individuals mentioned in the pages, particularly the smaller mentions of individuals that were missed by Claude. Another important aspect is that Gemini was much better at preserving the text order of the mentions as well as better capable of working out subtle differences around the same person depicted on photo/illustration and featured in the text. Because of this, I continued the further tests with Gemini, though these may be expanded in the future.</p>

<p>I refined the approach described earlier to the following list of identifiable items:</p>
<ul>
  <li>Filename (non-LLM captured)</li>
  <li>Page number on image (LLM captured)</li>
  <li>Person's name as it appears in the text (LLM captured)</li>
  <li>Person's title(s) (LLM captured)</li>
  <li>Person's standardised name (LLM captured)</li>
  <li>Person's job/profession/role (LLM captured)</li>
  <li>Person's associated organisation (LLM captured)</li>
  <li>Person's gender (LLM captured)</li>
  <li>Brief context for person's appearance in text (LLM captured)</li>
  <li>Person's relation to the text (LLM captured)</li>
  <li>Is the person depicted in a photo/illustration on the page (LLM captured)</li>
</ul>

<p>I combined the extraction of this information as instructions to Gemini inside a prompt. I then inserted it within a Python script that can be deployed on Google Colab. This script provides a basic UI for selecting an image or a batch of 5 images (from a Google Drive mounted folder) to be processed via Gemini with the click of a button. The raw output generated by Gemini is first saved into a log file, and afterwards restructured into a spreadsheet for the easier visibility of the people identified within the page. Each row corresponds to a page. The first column shows the filename, the second the identified page number, and the third the full transcription of the page (captured by the LLM). Each of the additional columns correspond to a person (and their associated information) identified on the page.</p>

<p>Below is an example entry with an explanation of what each element means:</p>
<pre>Mr. R. P. SLOAN | C.B.E., M.I.E.E. | SLOAN, R. P. | President, Chairman | British Electrical Developments Association, Newcastle-on-Tyne Electric Supply Co. | M | President of British Electrical Developments Association welcoming the new journal. | Contributor

Mr. R. P. SLOAN - name as it appears
C.B.E., M.I.E.E. - titles mentioned along the name in the text
SLOAN, R. P. - standardised name
President, Chairman - role/professions/job
British Electrical Developments Association, Newcastle-on-Tyne Electric Supply Co. - associated organisations
M - male
President of British Electrical Developments Association welcoming the new journal. - brief context for the person's work
Contributor - the relationship to the text</pre>

<p>We immediately see that the "relationship to the text" element is not correct, and this needs to be specified further in future processing of the text.</p>

<p>For better readability and for easier use on the Github page, I further transformed the file into additional xlsx and json formats. These can be found here:</p>
<p>Persons.xlsx: <a href="https://github.com/third-floor/electrical-age-experiments/blob/main/assets/data/persons.xlsx">https://github.com/third-floor/electrical-age-experiments/blob/main/assets/data/persons.xlsx</a></p>
<p>Persons.json: <a href="https://github.com/third-floor/electrical-age-experiments/blob/main/assets/data/persons.json">https://github.com/third-floor/electrical-age-experiments/blob/main/assets/data/persons.json</a></p>

<p>Using this method I was able to identify 2387 mentions of individuals, out of which around 150 referred to individuals who were depicted on an image. The number of "Mentions" is not the same as the unique number of individuals as this will require further cleaning of the dataset.</p>

<p>Using the generated dataset, I undertook preliminary analysis (that can be expanded upon):</p>

<p>Below is a graph that shows the number of persons mentioned on each page of the first volume. One pattern that emerges is a periodic high number of mentions. Many of these correspond to the sections of the issues that discuss the activities within the branches. There are also smaller spikes that correspond to the table of contents pages.</p>

<p>On average, there are around 5 mentions of people per page (the exact number is 4.995736), and the median of the mentions was 3 per page.</p>

<p>The (filenames for the) pages with the largest amount of mentions were the following:</p>
<pre>1926_page_0357l.png	41
1926_page_0309r.png	37
1926_page_0264l.png	36
1926_page_0334r.png	36
1926_page_0358l.png	32
1926_page_0267l.png	29
1926_page_0335r.png	28
1926_page_0359l.png	28
1926_page_0336r.png	27
1926_page_0015l.png	26</pre>

<p>Except for the 0015l, all of the pages described the branch activities. The page 0015l described the "E.A.W. Luncheon at the Hotel Cecil, June 4th, 1926", which included the mentions of many of the people attending the event.</p>

<p>The table below gives the most frequently mentioned names in the text:</p>
<pre>unknown		20
Miss Haslett		18
Dr. S. Z. de Ferranti	17
Mrs. Walter Lawson	17
Unknown		17
Lady Brooks		15
Margaret Partridge	14
Miss C. Haslett	14
Mary Mackirdy		14
Electra			13</pre>

<p>The "unknown" and "Unknown" refer to individuals that are depicted on advertisements or illustrations, though their presence is not consistently picked up. Therefore, I would suggest excluding them from future results.</p>

<p>In this list, the frequency measures the mentions of the names as they appear in the text. Hence the appearance of "Miss Haslett" alongside "Miss C. Haslett".</p>

<p>We can also create a list of the depictions identified within the journal. The table below gives us the top 30 depictions</p>
<pre>                         person_entry  depiction_count
unknown				19
Unknown				16
unnamed woman			4
None					3
Baby					2
Councillor Mrs. Gregory		2
Miss A. A. Stemp			2
Margaret Bondfield			2
Mrs. Hollis				2
Unidentified Woman			2
Unidentified Man			2
Councillor Rhoda Parker		1
Daughters of Dr. & Mrs. Ferranti	1
Dr. Christina Barrowman		1
Dr. Sebastian Ziani de Ferranti	1
Dame Henrietta Barnett		1
COUNCILLOR MRS. GREGORY	1
Chris					1
Anne Leeson				1
A man					1
Anne Snell				1
Annie					1
COLONEL R. E. CROMPTON	1
Alderman Mrs. Hammer		1
Hailware girl				1
HER SON				1
H.R.H. The Duchess of York		1
Fraulein Käthe Böhm			1
Ermine Elibank			1
Elizabeth Garrett Anderson		1</pre>

<p>We see in this list the same pattern of unnamed individuals identified most commonly (with the terms "unkown", "Unknown", "unnamed woman", "none", "Unidentified Woman", "Unidentified Man", "A man"). We also see that it sometimes included further description of the unidentified person, such as "Baby" and "Hailware girl". In both cases of "baby", the word baby appeared around the depiction, and "hailware girl" was given as the name of a fictional character illustrated in an advert for Hailglass (by Hailwood & Ackroyd).</p>

<p>We also see that the approach preserves references to relations, rather than trying to assign a name to a person. For example, we have references to "Daughters of Dr. & Mrs. Ferranti" and "Her Son" - the latter being a reference to a photo of Lady Pearl Montagu with her son.</p>

<p>A script was developed to search for the mentions of individuals that shows also the pages where the depictions appear, but this currently only works locally, as I would need to upload the images of the relevant pages. So currently you can only find the depictions by searching for Yes under the depictions column of the relevant dataset.</p>

<h3>Points of consideration during our next meeting:</h3>
<ul>
  <li>Most importantly, is there any other information we would like to extract that's currently missing?</li>
  <li>I want to add metadata for the different pages, so that we can carry out year-by-year analysis</li>
  <li>We need to make a decision about whether we want to capture unnamed people depicted on images</li>
  <li>We also need to make a decision whether we want to extract fictional as well as real characters (e.g. fictional characters are sometimes used as narrative devices in the articles)</li>
  <li>The output currently needs some additional cleaning, but once we have a json format locked in that meets our needs, the computational needs, and the Github needs, this data cleaning time will be significantly reduced</li>
  <li>As part of this work, I also recaptured the text from the pages. Is this something we need? My preference would be not to do this if we already have the OCR captured text for the pages anyway.</li>
  <li>The script sometimes returns names in brands (e.g. W. T. Henley's Telegraph Works Co. Ltd.). Is this something we would like to preserve?</li>
  <li>There is a specific "Our Portrait Page" section in the journals. Maybe this (name) can be the specific focus of something later?</li>
  <li>There are occasionally pages that have their titles double-spread for their titles. For extracting the names it didn't cause an issue, but for transcribing full text, this might be something to consider further.</li>
</ul>
`
};
