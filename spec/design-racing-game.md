---
title: Canvas Racing Game - Single-File HTML Game
version: 2.0
date_created: 2026-07-15
last_updated: 2026-07-15
owner: TBox
tags: [design, app, game, canvas, html, 3d, multiplayer]
---

# Introduction

A browser-based 3D perspective racing game with power-ups, two-player local multiplayer, and leaderboard system. Implemented entirely in a single `index.html` file using HTML5 Canvas and vanilla JavaScript. No external libraries or assets required.

## 1. Purpose & Scope

Build an advanced arcade-style racing game featuring:
- Pseudo-3D perspective rendering with depth scaling
- Power-up system (missile, shield, speed boost)
- Two-player split-screen local multiplayer
- Persistent leaderboard via localStorage

**Scope**: Single HTML file placed at `public/index.html`, replacing the previous version.

## 2. Definitions

- **Player car**: The car controlled by the user, positioned at the near end of the 3D perspective road
- **Obstacle car**: Enemy cars that spawn at the horizon and approach via 3D perspective scaling
- **Score**: A numeric value that increases over time as the player survives
- **Game Over**: The state triggered when the player car collides with an obstacle (unless shielded)
- **Power-up**: Collectible items on the road: Missile (M), Shield (S), Boost (B)
- **Missile**: Clears all on-screen obstacles when fired
- **Shield**: Temporary invincibility for 3 seconds
- **Boost**: Increased movement speed for 2 seconds
- **LaneX**: Horizontal position on road from -1 (left edge) to +1 (right edge)
- **Z-depth**: Depth position from 0 (horizon/far) to 1 (camera/near)

## 3. Requirements, Constraints & Guidelines

### Core Gameplay
- **REQ-001**: Pseudo-3D perspective road with vanishing point, cars scale with depth
- **REQ-002**: P1 uses A/D for movement, Q to fire missile
- **REQ-003**: P2 uses Left/Right arrows for movement, Enter to fire missile
- **REQ-004**: Obstacle cars spawn at horizon (z=0) and approach the camera (z→1)
- **REQ-005**: Collision triggers Game Over unless shield is active
- **REQ-006**: Score displayed in HUD per player, increases with survival time
- **REQ-007**: Difficulty increases over time (obstacle speed + spawn rate ramp over ~70s)
- **REQ-008**: ESC pauses/resumes the game

### Power-up System
- **REQ-009**: Missile earned automatically every 500 points (stackable)
- **REQ-010**: Shield/Boost/Missile power-ups spawn randomly on the road as collectibles
- **REQ-011**: Shield grants 3s invincibility with visible ring effect
- **REQ-012**: Boost grants 2s speed increase with trail effect
- **REQ-013**: Collectible missile grants +1 missile charge

### Multiplayer
- **REQ-014**: Split-screen mode with vertical divider for 2-player
- **REQ-015**: Each player has independent obstacles, score, and power-ups
- **REQ-016**: Game ends when all players are eliminated

### Leaderboard
- **REQ-017**: Top 10 scores persisted in localStorage
- **REQ-018**: Name entry prompt after game over (SPACE to save)
- **REQ-019**: Leaderboard accessible from main menu
- **REQ-020**: R key returns to menu from game over screen

### Constraints
- **CON-001**: All code in a single `public/index.html` file
- **CON-002**: No external libraries, frameworks, or CDN resources
- **CON-003**: HTML5 Canvas for game rendering, DOM for menus/overlays
- **CON-004**: 3D projection via non-linear z-scaling (perspective simulation)

### Guidelines
- **GUD-001**: requestAnimationFrame for smooth 60fps animation
- **GUD-002**: Responsive canvas sizing that fills the viewport
- **GUD-003**: Scrollbar hiding for mobile-preview-on-desktop
- **GUD-004**: Objects sorted by z-depth for correct draw order

## 4. Interfaces & Data Contracts

### Player State
```
{
  id: 1|2,
  laneX: number (-0.85..0.85),
  obstacles: [{ laneX, z, w, h, speed, color }],
  powerups: [{ laneX, z, type, w, h, pulse }],
  score: number,
  alive: boolean,
  missiles: number,
  shieldTimer: number (frames),
  boostTimer: number (frames),
  spawnTimer: number,
  frameCount: number,
  color: string
}
```

### 3D Projection
```
project3D(z: 0..1, laneX: -1..1, viewport) → { x, y, scale, roadW }
```

### Leaderboard Entry (localStorage)
```
{ name: string, score: number, player: 1|2, date: timestamp }
```

### Input Map
| Key | Action |
|-----|--------|
| A / D | P1 move left/right |
| Q | P1 fire missile |
| ArrowLeft / ArrowRight | P2 move left/right |
| Enter | P2 fire missile |
| ESC | Pause/Resume |
| SPACE | Save score (game over) |
| R | Return to menu (game over) |

## 5. Acceptance Criteria

- **AC-001**: 3D road renders with perspective convergence toward horizon
- **AC-002**: Cars scale smaller as they approach the horizon and larger as they near the camera
- **AC-003**: Missile clears all obstacles on screen and shows flash indicator
- **AC-004**: Shield prevents death on collision and shows ring effect around player car
- **AC-005**: Boost increases movement speed and shows flame trail behind car
- **AC-006**: Two-player mode shows split-screen with independent gameplay
- **AC-007**: Scores saved to localStorage and displayed on leaderboard
- **AC-008**: Main menu allows switching between 1P/2P/Leaderboard views

## 6. Test Automation Strategy

- **Test Levels**: Manual browser testing
- **Frameworks**: N/A (single-file game)
- **Verification**: `./scripts/build.sh` passes

## 7. Rationale & Context

The 3D perspective creates immersion without WebGL complexity. Pseudo-3D via z-depth projection and non-linear scaling achieves convincing depth. Split-screen multiplayer uses viewport clipping to isolate each player's rendering. localStorage provides persistent leaderboards without backend requirements.

## 8. Dependencies & External Integrations

No external dependencies. localStorage for leaderboard persistence.

## 9. Examples & Edge Cases

- Obstacles behind the horizon line are not drawn (clipped)
- Power-ups pulse visually to attract attention
- Missile flash notification appears when auto-earning at threshold
- Shield collision destroys the obstacle instead of killing the player
- In 2-player, one player can die while the other continues
- Name input supports Enter key to submit
- Leaderboard capped at 10 entries, sorted descending

## 10. Validation Criteria

- Build passes via `./scripts/build.sh`
- Game loads and renders 3D perspective correctly
- All power-ups function as specified
- Two-player split-screen works with separate inputs
- Leaderboard persists across page reloads
- No console errors during gameplay
