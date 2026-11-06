# Last Light: Saint Agnes Hospital

A first-person 3D horror escape game set across five distinct hospital floors: the general ward, operating theatre, records archive, isolation wing, and morgue. Each floor has named rooms branching off the corridor, with doors that open into the rooms. Search room furniture for the hidden keycard, then use the correctly oriented stairwell door to descend. Each capture sends you back to Floor 05; five captures end the run.

Plague doctor PNGs in `public/assets/` provide the doctor visuals; the game uses the supplied transparent artwork directly. Doctors and patients arrive in randomly selected rooms at staggered random intervals, pursue the player inside their detection radius, and return to wandering when the player gets away. The floors and room props are procedurally assembled in Three.js with separate lighting palettes and brightness levels.

## Play

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The game uses pointer lock: click **Begin Descent**, move with **W A S D**, look with the **mouse**, and press **E** near a door to open it or near a person to speak. Doctor dialogue is spoken using the browser's built-in text-to-speech voice; patient dialogue remains text. Search the rooms and press **E** at the keycard and stairwell. Hold **Shift** to run; plague doctors pursue faster than patients. Press **Escape** to pause.

The game is built with Three.js and Vite. The hospital is generated in the browser; no external game assets are required.
