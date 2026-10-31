# Handy

Handy is a free, open-source creative studio. It is one desk with six rooms you can open on top of each other. The whole application lives in this folder.

| Room | What you do |
| --- | --- |
| Thinking | Lay out frames, shapes, paths, and type |
| Formulation | Build forms, move them on axes, and sculpt or smooth the surface |
| Rendering | Watch a realtime view, then sample a still or an orbit sequence |
| Idea | Paint, grade color, and soft-proof ink for print |
| Animation | Edit rendered frames and dropped image sequences on a timeline |
| Game | Place those forms in a scene and play it |

Work moves with the project:

- A Thinking layout can be sent into Idea.
- Formulation forms show up in Rendering and can be placed in Game.
- Kept Rendering frames can be sent to Animation, and the latest frame can stand in the Game.
- The grade in Idea warms or cools the Game floor.

Handy is an independent project. It is not affiliated with other design, 3D, rendering, or editing products.

The license is MIT. See `LICENSE`.

## Install

You need [Node.js](https://nodejs.org/) 20 or newer. Download this folder, then in a terminal:

```bash
cd handy
npm install
npm start
```

`npm start` prints a local address, usually `http://localhost:5173`. Open it in a browser. Leave that terminal running while you use the app.

### Windows and macOS

1. Open the address in Chrome or Edge.
2. Use the Install button in Handy when it appears, or the browser menu entry **Install Handy**.
3. The app then opens in its own window.

For a copy you can host, build the static site and preview it:

```bash
npm run build
npm run preview
```

The installable files are in `dist/`.

### iPhone

1. Run Handy on a computer and open the network address Vite prints (the one that is not `localhost`). The phone has to be on the same Wi-Fi.
2. In Safari, tap Share, then **Add to Home Screen**.

You can also host the `dist/` folder and add that site to the Home Screen.

### Android

1. Open the address in Chrome.
2. Use **Install app** or **Add to Home screen**.

## Your project

Handy stores the project in this browser. **File → Save file** downloads a `.handy.json` file you can open later on another device. **File → Open** reads that file back.

## Scripts

```bash
npm start     # open the studio
npm test      # check color, files, and the renderer
npm run build # typecheck and write dist/
```

## Shortcuts

- `1` through `6` open the rooms
- `Ctrl` or `Cmd` `S` saves a project file
- `Ctrl` or `Cmd` `Z` undoes
- `?` shows install steps and shortcuts
