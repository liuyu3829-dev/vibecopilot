# Report curation and tag clarity

> 历史设计记录：保留当时的决策背景，不代表当前实现。

## Goal

Make tags and report source selection understandable without changing capture, desktop-orb, storage, or existing report snapshots.

## Decisions

- Stop generating and displaying DeepSeek automatic tags for newly analyzed thoughts. Existing automatic tags remain stored for compatibility but are not shown in the thought interface.
- Keep only user-managed tags in the thought interface. They have a distinct muted accent color, no `#` prefix, and no text label such as “my tags”.
- Remove the daily-report checkbox from thought cards.
- In the Reports view, show the selected Shanghai date's thoughts as a compact source list with a checkbox for each thought. A user selects sources there, then generates or regenerates the report.
- Selection persists in `report_included` so the report screen can be left and resumed. It is not presented as an intrinsic thought status elsewhere.
- A generated report remains an immutable snapshot of the selected source IDs, timestamps, and transcripts. Changing selection later affects only future regeneration.

## Report writing modes

- The Reports view offers a mode selector before generation. The chosen mode is stored with the report snapshot and never changes when the interface language changes.
- **Short essay** is an adaptive-length, concise opinion piece. It states one modest central judgement, then develops only the two or three source-grounded reasons needed to support it. It may use light Markdown section headings. Its voice can be editorial, but it must not manufacture facts, feelings, or conclusions.
- **Post** is one first-person post with a generation-only length preference: short, adaptive (default), or long. It absorbs every selected thought's distinct core point without quoting or listing source thoughts in order. Short normally stays around 180–380 Chinese characters, adaptive follows the selected material's amount and density, and long normally has 600–1,400 characters available for fuller reasoning. The preference never permits omitting a selected point. It has no title, hashtags, call to action, generic hook, motivational lesson, or synthetic emotional language.
- Both modes use the same two-stage generation: first an evidence outline that cites every selected thought ID, then the requested form of writing. Post generation additionally returns its covered thought IDs; the server rejects incomplete coverage. A failed regeneration keeps the existing saved snapshot.

## Validation

- New analyzed thoughts display no AI-generated tags.
- Manual tags can be added, removed, reused, and filtered without a `#` prefix.
- The Thoughts view has no report-selection control.
- The Reports view can select and deselect date-local thoughts before generation.
- Generation uses exactly the checked items; saved evidence remains unchanged after later selection changes.
- Existing capture, desktop-orb save, and report-reading behavior remains covered by the regression suite.
- The report page presents source selection on the left and the generated reading surface on the right at desktop widths; narrow screens stack them without changing data or mode behavior.
