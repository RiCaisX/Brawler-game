# Brawler Game Walkthrough


## Features Added

### 1. Two-Player Action
The game accommodates both players on the same keyboard cleanly.
- **Player 1 (Blue)**: Moves with **W, A, D** keys. Attacks with **1** (basic) and **2** (heavy).
- **Player 2 (Red)**: Moves with **Up/Left/Right Arrows**. Attacks with **N** (basic) and **M** (heavy).

### 2. Physics & Core Mechanics
- Both characters are bound by gravity and canvas boundaries.
- Attacks enforce hitboxes momentarily when an attack button is pressed. If the hitbox overlays the opposing player, damage is registered and a knockback effect is applied.

### 3. Attack System & Cooldowns
- Basic Attacks: Low damage (`5`), very quick attack window.
- Heavy Attacks: High damage (`20`), longer attack range. To keep gameplay balanced, it is tied to a **3-second cooldown**.

### 4. Character Classes
Before the game begins, an overlay allows both players to choose an archetype:
- **Tank:** Large hitbox, massive health (`150 HP`), huge damage and attack range. However, they suffer from painfully slow movement and basic attack cooldowns. 
- **DPS:** The original baseline character. Medium size, health (`100 HP`), and decent speed. Reliable and balanced.
- **Healer:** Tiny hitbox, low health (`80 HP`), fast movement, but weak attacks. They feature a **Regeneration Passive**: Any damage taken from basic attacks is marked as temporary. If the Healer avoids combat for 6 seconds, they will rapidly regenerate their temporary damage. Heavy attacks, however, deal permanent damage.

<div style="display: flex; gap: 10px;">
  <img src="images\character_selection_screen_1773658728766.png" style="width: 48%;">
  <img src="images\healer_regen_after_17s_1773658780515.png" style="width: 48%;">
</div>

### 5. Aerial Combat & Ring-Outs
- **Platforms:** The map now features multiple layered platforms instead of a solid flat floor. 
- **Blast Zones:** To combat corner-camping, players who are knocked off the bottom or sides of the screen enter a "blast zone". Doing so instantly depletes their health to 0, granting the opponent victory.
- **Ring-Out Fire Effect:** When a player crosses the blast zone threshold, a continuous rising pillar of fire erupts from their elimination point. The Game Over screen is delayed by **1.5 seconds** to allow this dramatic animation to unfold.
- **Player Scaling:** Player size was slightly reduced (`40x80`) to make platforming and dodging feel more precise.


### 5. Dynamic UI
- Health bars decrement correctly representing a percentage of remaining health.
- Cooldown overlays visually demonstrate when players can use heavy attacks again, alongside text indicators showing the time remaining.


## Validation
Game inputs, canvas layout, hit registration, health subtraction, and cooldown functionalities have been verified with an autonomous browser subagent. The subagent confirmed multiple success cases:
- Both sets of keys correctly alter character velocities or attack states.
- Heavy attacks go on cooldown preventing consecutive spam.
- Health tracks to 0 triggering the win condition properly.
