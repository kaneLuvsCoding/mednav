# MEDNAV frontend

React + Vite + TypeScript mission health console. Local synthetic data only; no backend required.

From frontend/:

    npm install
    npm run dev
    npm run build
    npm test

The browser tests use installed Microsoft Edge. Preview: http://127.0.0.1:5173.

See README_UI_HANDOFF.md for the current component map, scenario fixture model, shared state flow, verification, and GitHub publishing prerequisites.

Core views: mission health console, check-in, investigation, what-if control drawer, inventory, and current incident report. State is held in React memory and resets on refresh. All timestamps and readings are synthetic. Historical charts use fixed fixtures. All next-check examples are scripted, require officer review and are not clinically validated. No diagnosis, treatment or automatic emergency detection is performed.
