# Shared

Code shared by the frontend and backend lives here.

Planned responsibilities:

- Board state types.
- Match detection and resolution helpers.
- Charge, attack, health, and win-condition rules.
- Protocol message types for future multiplayer.
- Deterministic utilities that are safe to run in both browser and server contexts.
- Tuning config for battle values, charge gains, AI speed, and input thresholds.

Avoid direct DOM, canvas, audio, storage, or network APIs in this folder.
