# Live Shot

You're the camera operator at a live show. Pick tonight's show, and you have three cameras to capture it. Switch between them, move them, zoom, and record the show. At the end you get a score and the actual video you recorded.

## Run

```bash
./run.sh            # or "Live Shot" in the app menu
npm run dev         # development server with live reload (http://localhost:5180)
```

## The shows

| Show | Venue | What happens |
|------|-------|--------------|
| **The Neon Foxes** | Arena rock concert | Singer runs on, guitar knee slide, drum fill, singer jump, pyro finale |
| **DJ Volta** | Warehouse rave | Lasers, CO2 cannons, a dancer's backflip, the DJ climbs the desk. Sometimes the director wants a crowd shot |
| **The Velvet Room** | Late-night jazz club | Sax, piano and drum solos, the singer's big final note, the band's bow |
| **The Great Zandini** | Theatre magic show | Rabbit from a hat, levitation, a vanishing box, and the assistant reappears somewhere in the audience |

Each show has its own three camera positions (shown on the menu) and its own best score.

## Controls

1/2/3 switch camera · Space takes the shot live (Director mode) · click the picture and use the mouse (or arrow keys) to pan and tilt · WASD to move · Q/E to lower or raise · scroll or Z/X to zoom · Shift for fine moves · C resets the camera · R records · G toggles guides · P pauses · H shows help.

## Scoring

- Points every second for how well the **live** camera frames whoever the director asks for (a person, the whole band, or the crowd). Points only count while you're recording.
- +250 for each big moment (★) you catch.
- +50 for a good cut right at a section change. −25 for a jump cut (less than 1.2 seconds on a shot).
- Holding one shot for more than about 12 seconds slowly earns fewer points.
- Grades go from S to F.

## Code map

- `src/shows/` – one file per show: setlist, director cues, big moments, cast + choreography, music arrangement, venue config and camera rigs. `index.js` lists them.
- `src/show.js` – show clock helpers (current section, upcoming moment) for whichever show is loaded
- `src/people.js` – jointed people models and poses shared by all shows
- `src/props.js` – instruments and props (drum kit, grand piano, DJ booth, magic box…)
- `src/stage.js` – venue builder: room, stage, lights, screens, crowd, lasers, pyro, smoke and confetti
- `src/music.js` – Web Audio synth instruments and sequencer; each show writes its own arrangement
- `src/cameras.js` – camera rigs, limits, zoom ranges
- `src/scoring.js` – framing evaluation and scoring
- `src/recorder.js` – records the program feed (video + audio) to WebM
- `src/main.js` – show picker, game loop, input, multiview rendering, HUD

Feature backlog: see `FEATURES.md`.
