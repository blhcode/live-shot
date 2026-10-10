# Live Shot

You're the camera operator at a concert. **The Neon Foxes** play a ~2 minute song on stage, and you have three cameras to capture it. Switch between them, move them, zoom, and record the show. At the end you get a score and the actual video you recorded.

## Run

```bash
./run.sh            # or "Live Shot" in the app menu
npm run dev         # development server with live reload (http://localhost:5180)
```

## The cameras

| Cam | Where | Good for |
|-----|-------|----------|
| 1 · PIT | Tripod in the photo pit, slides along the stage front | Close-ups |
| 2 · FOH RISER | Behind the crowd, very long zoom | Wides and telephoto |
| 3 · STAGE WING | Handheld on stage-right (has natural shake) | Side angles, drummer and keys |

## Controls

1/2/3 switch camera · Space takes the shot live (Director mode) · click the picture and use the mouse (or arrow keys) to pan and tilt · WASD to move · Q/E to lower or raise · scroll or Z/X to zoom · Shift for fine moves · C resets the camera · R records · G toggles guides · P pauses · H shows help.

## Scoring

- Points every second for how well the **live** camera frames whoever the director asks for. Points only count while you're recording.
- +250 for each big moment (★) you catch: singer runs on, guitar knee slide, drum fill, singer jump, pyro finale.
- +50 for a good cut right at a section change. −25 for a jump cut (less than 1.2 seconds on a shot).
- Holding one shot for more than about 12 seconds slowly earns fewer points.
- Grades go from S to F.

## Code map

- `src/show.js` – setlist, director focus, big moments (edit here to change the show)
- `src/music.js` – synthesised band (Web Audio), synced to the show clock
- `src/performers.js` – the band models and their choreography
- `src/stage.js` – venue, lights, LED wall, crowd, pyro and confetti
- `src/cameras.js` – camera rigs, limits, zoom ranges
- `src/scoring.js` – framing evaluation and scoring
- `src/recorder.js` – records the program feed (video + audio) to WebM
- `src/main.js` – game loop, input, multiview rendering, HUD

## Ideas for later

- More songs and venues (festival main stage, small club, orchestra)
- Camera 4: a jib/crane or a dolly on a track
- A replay review after the show that marks good and bad moments on a timeline
- Difficulty levels (fewer cues, faster performers)
- Show the REC/tally state on the fan LCD
