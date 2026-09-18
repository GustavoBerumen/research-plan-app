# RPA-77: checks that need a person and a real editor

The automated tests hold that the download is a sound zip of well-formed Word
parts with the right content. They cannot hold the ticket's hardest line: that
**Microsoft Word opens the file with no repair warning**. Nor what other
editors make of it. These are those checks.

Make the file from a realistic plan: every section filled, two studies, a long
Background with line breaks, an emoji and accented letters somewhere, one
"Other" sample size, a Previous Knowledge row, one Additional information
block, and the lead researcher signed.

| # | Where | Do | Expect |
| --- | --- | --- | --- |
| 1 | Word for Windows | Open the downloaded .docx | Opens at once. No "found unreadable content", no repair prompt, no Protected View beyond the usual banner for a downloaded file |
| 2 | Word for Windows | View > Navigation Pane | Context, Research, Studies and methodology, Execution, Sign-off, with the field names under them |
| 3 | Word for Windows | Change a paragraph, a date in the schedule and a stage name; add a row to the schedule; add a research question | All editable as ordinary Word content; the new question takes the next number |
| 4 | Word for Windows | Save, close, reopen | The edits are there; still no warning |
| 5 | Word for Windows | References > Table of Contents > insert one | Built from the headings |
| 6 | Word for Mac | 1, 3 and 4 again | The same |
| 7 | Word on the web | Upload and open | Opens for editing, not only viewing |
| 8 | Google Docs | Upload, open with Google Docs | Headings, numbered lists starting at 1, tables with borders. Note anything that differs |
| 9 | LibreOffice Writer | Open | As 8 |
| 10 | Pages | Open | As 8. (Checked on 17 September 2026 through the macOS importer and preview: headings, lists restarting at 1, tables, Unicode and emoji all present) |
| 11 | Windows Chrome | Download from the Menu and from Review | One file each press, named "<title> - research plan - <date>.docx", in the usual downloads place |
| 12 | Windows Opera | 11 again | The same |
| 13 | A phone | Download from the Menu | The browser saves it or opens it in a viewer; either is the browser's to decide. Note which |
| 14 | Any | Press the button, then look at the form | Same page, same answers, Last updated unchanged |

Record the editor, its version and the date beside each row that was checked,
and anything that differed from "Expect", on RPA-77.

Not in this slice, by decision (Gus, 17 September 2026): a direct PDF download
(Print or save as PDF still gives a PDF), and a picture of the timeline chart
(the schedule table is the editable timeline).
