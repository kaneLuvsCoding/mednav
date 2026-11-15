# 90-second live demo

Rehearse with the actual integrated app. All values are fictional. Never narrate
pending tests as passed. Have a local recording only after recording a working run.

| Time | Live action | Spoken script |
|---|---|---|
| 0–15s | Show title and visible synthetic label | “MEDNAV is a research prototype for health self-monitoring when communication and supplies are limited. It highlights missing information and feasible next checks. It does not diagnose or prescribe.” |
| 15–30s | Select Crew A and display historical trend | “These four crew members and their thirty-day histories are entirely fictional. NASA research informs our problem framing; these readings are not NASA astronaut telemetry.” |
| 30–45s | Load S04; show missing BP and zero usable monitors | “Here, headache and dizziness are reported, but blood pressure is unknown. The inventory has no usable monitor. Missing information stays unknown rather than being filled with a normal value.” |
| 45–65s | Investigate; show actual output, constraints, explanation | “The result separates observations, missing evidence and resource constraints. Any selected check must be feasible with available equipment. The cause remains unknown, and this is not a diagnosis.” |
| 65–75s | With external network already disconnected, rerun; optionally show S10 | “The core workflow is running locally. A manual emergency override bypasses ordinary ranking and directs the crew to its mission-approved workflow.” Say this ONLY after the offline test passes. |
| 75–90s | Display actual report counts and limitation | “These are our executed software test results, with skipped tests shown separately. They assess behavior in synthetic scenarios, not medical effectiveness. MEDNAV is a hackathon prototype, not clinically validated.” |

If integration is not ready, present this as a planned demo. Do not pretend the CSV
files, screenshots or response fixtures demonstrate a working end-to-end app.
Avoid quoting a success percentage unless the underlying tests and denominators
are present. Voice/3D is optional and omitted from this core 90-second sequence.
