# Isai Keys · இசை

Learn keyboard the way Simply Piano teaches it — scrolling sheet music, notes that wait for you, play-along scoring — but built around **Tamil film music**. Western (C D E) and Carnatic (Sa Ri Ga) names are shown side by side and can be typed interchangeably.

**Live app:** https://rbragadesh.github.io/claude_tamilpiano/ (after GitHub Pages is switched on — see below)

## What's inside

- **Course (29 lessons):** finding Sa, reading the treble and bass staff, rhythm (quarter / half / eighth notes, rests, dotted rhythm), left hand, chords and inversions, and ragas used in film music (Mayamalavagowla sarali and janta varisai, Mohanam, Kalyani, Keeravani, Shivaranjani, Hindolam).
- **Three practice modes:** *Wait* (the song waits until you play the right note or chord), *Play* (in time, scored Perfect / Early / Late / Miss) and *Listen*.
- **Listens through the microphone** to your real keyboard — single notes and chords. You can also tap the on-screen keys. On a laptop, a MIDI keyboard works too.
- **Two views:** sheet music (grand staff, key signatures, chord names, a sargam line) or falling notes.
- **Raga explorer** with any Sa, scale playback, a tanpura drone, and Western equivalents.
- **Your own library** grouped by composer and era (70s to 2020s):
  - **From YouTube:** paste a link, mark the start and end of the part, then loop it and slow it down. Get the notes by *Listen & draft* (the mic transcribes a rough draft), *Play it in* (you play it and the app writes it down) or *Type*. The original clip then plays as your backing track.
  - **Type or paste notes** in Western or sargam, with one-tap conversion between them.
  - **Import a MIDI file** and pick the melody and bass tracks.
- Works offline once installed (except YouTube). Library backup and restore as a JSON file.

## Turn on GitHub Pages (one time)

1. On GitHub open **rbragadesh/claude_tamilpiano → Settings → Pages**.
2. Under *Build and deployment* choose **Source: Deploy from a branch**, then **Branch: `main`**, folder **`/ (root)`**, and **Save**.
3. Wait about a minute. The site appears at `https://rbragadesh.github.io/claude_tamilpiano/`.

## Install on iPhone

1. Open the link above in **Safari**. (Other browsers on iPhone can't add web apps to the home screen as well.)
2. Tap **Share → Add to Home Screen**.
3. Launch it from the home screen icon. Allow the microphone when asked.
4. Turn the phone sideways while playing for a wider view of the music.

## Writing notes

```
Western:  C D E F G A B   sharps/flats: C# Eb
Carnatic: S R G M P D N   or  Sa Ri Ga Ma Pa Dha Ni
          variants R1 R2 G2 G3 M1 M2 D1 D2 N2 N3 (otherwise the song's raga decides)
Mix them: S R G C# E5 Pa
Octaves:  C5 (absolute)   C' or S' = up   C, or .S = down
Length:   C:2  C:1/2  C:1.5   or hold with  C - -   /  S , ,
Rest:     _      Fast: (C D) = two notes in one beat
Chord:    [C E G]   Chord names box: | C | Am | F G |
Sections: a line starting with #   e.g.  # Pallavi
```

## Limitations

- **Microphone detection** is reliable for single notes in a quiet room. Chords are checked against the notes the app *expects*, which works well, but an incomplete chord can sometimes pass. iPhone browsers have no Web MIDI, so a USB or Bluetooth MIDI keyboard can't connect on iPhone.
- **Listen & draft is a rough draft.** A film mix (voice, orchestra, gamakas) can't be turned into exact notes automatically. Expect to fix notes by hand, or use *Play it in*. It works best on clear melody lines and when the video plays from a separate speaker or laptop.
- **YouTube:** some uploads block embedding. If yours does, try another upload of the same song. iPhone may need you to tap ▶ on the video once before the app can start it. With the mic on and the original playing through the speaker, use **wired headphones** so the app only hears you.
- **Storage:** your library lives on the device (IndexedDB). Use *Settings → Export backup* now and then.
- **Copyright:** lesson melodies are traditional Carnatic exercises or originals written for this app. Keep your film-song transcriptions in your own on-device library, and don't commit them to this public repo.

## Development

Plain HTML/CSS/JavaScript modules with no build step.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
npm test                       # parser, MIDI and theory tests (Node 18+)
node tests/detector.test.js    # pitch / chord detection on synthetic piano tones
node tests/content.test.js     # every built-in lesson parses cleanly
```

| File | Purpose |
|---|---|
| `js/theory.js` | note spelling, sargam, ragas, chords, key detection |
| `js/notation.js` | Western/Carnatic text notation ⇄ notes |
| `js/midi.js` | Standard MIDI File import |
| `js/detector.js` | mic pitch (YIN), chord check, onsets, transcription helpers |
| `js/player.js` | Wait / Play / Listen engine and scoring |
| `js/staff.js`, `js/falling.js`, `js/keyboard.js` | renderers |
| `js/studio.js`, `js/youtube.js` | YouTube studio and player sync |
| `js/editor.js` | song editor |
| `js/content.js` | course and practice pieces |
| `js/app.js` | screens and navigation |
