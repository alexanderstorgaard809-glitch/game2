# Iron Frontier

A 3D real-time strategy game for the browser, inspired by Warzone 2100.

**Play:** open `index.html` in a browser (it is a single self-contained file).

## Features
- Campaign with 6 story missions, plus skirmish on 3 maps (Desert Canyon, Frozen Pass, Ruined City)
- Unit designer: combine bodies, propulsion (wheels, half-tracks, tracks, hover, VTOL) and weapons
- Research tree, veteran ranks, repair units and Repair Facility, VTOLs with AA defenses
- Defenses: Guard Tower, MG Bunker, Cannon Hardpoint, Mortar Pit, AA Site, walls
- Fog of war, synthesized sound effects and voice alerts, unit groups (Ctrl+1-9), save/load

## Development
Source lives in `src/`. After editing, rebuild the single-file game:

```
python3 build.py
```

three.js (MIT) is vendored in `vendor/`.
