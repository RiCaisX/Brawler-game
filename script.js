const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1024;
canvas.height = 576;

// Physics constants
const GRAVITY = 0.6;

// Platforms
const platforms = [
    { x: 200, y: 450, width: 624, height: 20 }, // Main stage
    { x: 100, y: 300, width: 200, height: 15 }, // Left platform
    { x: 724, y: 300, width: 200, height: 15 }, // Right platform
    { x: 362, y: 150, width: 300, height: 15 }  // Top middle platform
];

// Blast zones (where players die)
const DEATH_Y = canvas.height + 200;
const DEATH_X_LEFT = -200;
const DEATH_X_RIGHT = canvas.width + 200;

// Inputs
const keys = {
    // Player 1
    w: { pressed: false },
    a: { pressed: false },
    d: { pressed: false },
    1: { pressed: false }, // Basic Atk
    2: { pressed: false }, // Heavy Atk

    // Player 2
    ArrowUp: { pressed: false },
    ArrowLeft: { pressed: false },
    ArrowRight: { pressed: false },
    n: { pressed: false }, // Basic Atk
    m: { pressed: false }, // Heavy Atk
};

// UI Elements
const ui = {
    p1Health: document.getElementById('p1-health'),
    p2Health: document.getElementById('p2-health'),
    p1CdText: document.getElementById('p1-cd-text'),
    p2CdText: document.getElementById('p2-cd-text'),
    p1CdFill: document.getElementById('p1-cd-fill'),
    p2CdFill: document.getElementById('p2-cd-fill'),
    timer: document.getElementById('match-timer'),
    gameOverScreen: document.getElementById('game-over-screen'),
    winText: document.getElementById('win-text'),
    charSelectScreen: document.getElementById('character-select-screen'),
    startGameBtn: document.getElementById('start-game-btn'),
    uiLayer: document.getElementById('ui-layer')
};

// Classes Definition
const CHAR_CLASSES = {
    tank: {
        width: 60, height: 110,
        maxHealth: 150,
        speed: 2.5, jumpPower: -14.5,
        basicDamage: 12, heavyDamage: 30,
        basicRange: 130, heavyRange: 180,
        basicCooldown: 800, heavyCooldown: 4000,
        attackDuration: { basic: 200, heavy: 500 }
    },
    dps: {
        width: 40, height: 80,
        maxHealth: 100,
        speed: 4.5, jumpPower: -15,
        basicDamage: 5, heavyDamage: 20,
        basicRange: 100, heavyRange: 150,
        basicCooldown: 100, heavyCooldown: 3000,
        attackDuration: { basic: 100, heavy: 300 }
    },
    healer: {
        width: 30, height: 60,
        maxHealth: 80,
        speed: 6.5, jumpPower: -17,
        basicDamage: 3, heavyDamage: 10,
        basicRange: 80, heavyRange: 120,
        basicCooldown: 100, heavyCooldown: 2500,
        attackDuration: { basic: 100, heavy: 300 }
    }
};

// Particles Array for Fire effect
const particles = [];

class Particle {
    constructor({ position, velocity, radius, color, lifeSpan }) {
        this.position = position;
        this.velocity = velocity;
        this.radius = radius;
        this.color = color;
        this.lifeSpan = lifeSpan;
        this.opacity = 1;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.draw();
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.opacity -= 1 / this.lifeSpan; // Fade out
    }
}

class Sprite {
    constructor({ position, velocity, color, identifier, charClass, facingRight }) {
        this.position = position;
        this.velocity = velocity;
        this.color = color;
        this.identifier = identifier; // 'p1' or 'p2'
        this.charClass = charClass;
        this.facingRight = facingRight;

        // Stats from class
        const stats = CHAR_CLASSES[charClass];
        this.width = stats.width;
        this.height = stats.height;
        this.maxHealth = stats.maxHealth;
        this.health = stats.maxHealth;
        this.speed = stats.speed;
        this.jumpPower = stats.jumpPower;

        // Combat
        this.isAttacking = false;
        this.attackType = null; // 'basic' or 'heavy'
        this.attackBox = {
            position: { x: this.position.x, y: this.position.y },
            offset: { x: 0, y: 0 },
            width: stats.basicRange,
            height: 50
        };

        // Cooldowns
        this.lastHeavyAttack = 0;
        this.lastBasicAttack = 0;

        // Healer specific mechanics
        this.healableDamage = 0;
        this.lastHitReceivedTime = Date.now();
        this.lastHealTick = 0;

        // Tracking how they died
        this.diedFromRingOut = false;
    }

    draw() {
        // Draw Player
        ctx.fillStyle = this.color;
        ctx.fillRect(this.position.x, this.position.y, this.width, this.height);

        // Draw attack box if attacking
        if (this.isAttacking) {
            ctx.fillStyle = this.attackType === 'heavy' ? 'rgba(255,165,0,0.5)' : 'rgba(255,255,255,0.5)';
            ctx.fillRect(
                this.attackBox.position.x,
                this.attackBox.position.y,
                this.attackBox.width,
                this.attackBox.height
            );
        }

        // Draw healable damage indicator if healer
        if (this.charClass === 'healer' && this.healableDamage > 0) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
            ctx.fillRect(this.position.x, this.position.y - 10, (this.healableDamage / this.maxHealth) * this.width, 5);
        }
    }

    update() {
        this.draw();

        // Update attack box position and width dynamically based on facing
        this.attackBox.offset.x = this.facingRight ? this.width : -this.attackBox.width;
        this.attackBox.position.x = this.position.x + this.attackBox.offset.x;
        this.attackBox.position.y = this.position.y;

        // Apply physics
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // Check platform collisions
        let onGround = false;
        for (let i = 0; i < platforms.length; i++) {
            const platform = platforms[i];

            // If player's bottom was above the platform last frame, and is below/on it this frame, and falling
            if (
                this.position.y + this.height - this.velocity.y <= platform.y &&
                this.position.y + this.height >= platform.y &&
                this.position.x + this.width >= platform.x &&
                this.position.x <= platform.x + platform.width &&
                this.velocity.y > 0
            ) {
                this.velocity.y = 0;
                this.position.y = platform.y - this.height;
                onGround = true;
            }
        }

        if (!onGround) {
            this.velocity.y += GRAVITY;
        }

        // Ring-out checks
        if (this.health > 0 && (this.position.y > DEATH_Y || this.position.x < DEATH_X_LEFT || this.position.x > DEATH_X_RIGHT)) {
            this.health = 0;
            this.diedFromRingOut = true;

            // Set up a fire spawner at the edge instead of a single burst
            let spawnX = this.position.x + this.width / 2;
            let spawnY = canvas.height;

            if (this.position.y > DEATH_Y) spawnY = canvas.height;
            if (this.position.x < DEATH_X_LEFT) { spawnX = 0; spawnY = canvas.height; }
            if (this.position.x > DEATH_X_RIGHT) { spawnX = canvas.width; spawnY = canvas.height; }

            fireSpawners.push({
                x: spawnX,
                y: spawnY,
                duration: 90 // 1.5 seconds of spawning fire (at 60fps)
            });
        }

        this.updateHealerRegen();
    }

    updateHealerRegen() {
        if (this.charClass !== 'healer' || this.healableDamage <= 0 || this.health <= 0) return;

        const now = Date.now();
        // 6 seconds without being hit
        if (now - this.lastHitReceivedTime > 6000) {
            // Heal 1 HP every 100ms
            if (now - this.lastHealTick > 100) {
                this.health += 1;
                this.healableDamage -= 1;

                if (this.health > this.maxHealth) this.health = this.maxHealth;
                if (this.healableDamage < 0) this.healableDamage = 0;

                this.lastHealTick = now;

                // Update UI visually
                const pHealthUI = this.identifier === 'p1' ? ui.p1Health : ui.p2Health;
                pHealthUI.style.width = (this.health / this.maxHealth * 100) + '%';
            }
        }
    }

    attack(type) {
        if (this.isAttacking) return;

        const stats = CHAR_CLASSES[this.charClass];
        const now = Date.now();

        if (type === 'heavy') {
            if (now - this.lastHeavyAttack < stats.heavyCooldown) return; // Cooldown active
            this.lastHeavyAttack = now;
            this.attackBox.width = stats.heavyRange;
        } else {
            if (now - this.lastBasicAttack < stats.basicCooldown) return; // Basic attack CD
            this.lastBasicAttack = now;
            this.attackBox.width = stats.basicRange;
        }

        this.attackType = type;
        this.isAttacking = true;

        setTimeout(() => {
            this.isAttacking = false;
        }, type === 'heavy' ? stats.attackDuration.heavy : stats.attackDuration.basic);
    }
}

// Global Variables
let player1;
let player2;
let gameStarted = false;
let isGameOver = false; // Tracks if the game over sequence has started
let selectedChars = { p1: 'dps', p2: 'dps' };
const charList = ['dps', 'tank', 'healer'];
const fireSpawners = [];

// Handle Character Selection UI (Mouse)
document.querySelectorAll('.char-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const player = btn.dataset.player;
        const char = btn.dataset.char;
        selectedChars[player] = char;

        // UI toggle
        document.querySelectorAll(`.char-btn[data-player="${player}"]`).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });
});

function updateCharSelectionUI(player) {
    const char = selectedChars[player];
    document.querySelectorAll(`.char-btn[data-player="${player}"]`).forEach(b => {
        if (b.dataset.char === char) {
            b.classList.add('selected');
        } else {
            b.classList.remove('selected');
        }
    });
}

ui.startGameBtn.addEventListener('click', () => {
    ui.charSelectScreen.classList.add('hidden');
    ui.uiLayer.classList.remove('hidden');
    canvas.classList.remove('hidden');
    initGame();
});

function initGame() {
    // Instantiate Players based on selection
    player1 = new Sprite({
        position: { x: 300, y: 100 },
        velocity: { x: 0, y: 0 },
        color: '#3498db',
        identifier: 'p1',
        facingRight: true,
        charClass: selectedChars.p1
    });

    player2 = new Sprite({
        position: { x: 684, y: 100 },
        velocity: { x: 0, y: 0 },
        color: '#e74c3c',
        identifier: 'p2',
        facingRight: false,
        charClass: selectedChars.p2
    });

    // Reset health UI to 100% since max depends on class
    ui.p1Health.style.width = '100%';
    ui.p2Health.style.width = '100%';

    gameStarted = true;
    isGameOver = false;
    particles.length = 0;
    fireSpawners.length = 0;
    decreaseTimer();
    gameLoop();
}


// Event Listeners for Input
window.addEventListener('keydown', (e) => {
    // Restart shortcut
    if (isGameOver && (e.key === ' ' || e.code === 'Space')) {
        location.reload();
        return;
    }

    if (!gameStarted) {
        // Start game shortcut
        if (!ui.charSelectScreen.classList.contains('hidden')) {
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                ui.startGameBtn.click();
            }

            // Player 1 Selection (W/S)
            if (e.key === 'w' || e.key === 's') {
                let currentIndex = charList.indexOf(selectedChars.p1);
                if (e.key === 'w') currentIndex = (currentIndex - 1 + charList.length) % charList.length;
                if (e.key === 's') currentIndex = (currentIndex + 1) % charList.length;
                selectedChars.p1 = charList[currentIndex];
                updateCharSelectionUI('p1');
            }

            // Player 2 Selection (Up/Down)
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                let currentIndex = charList.indexOf(selectedChars.p2);
                if (e.key === 'ArrowUp') currentIndex = (currentIndex - 1 + charList.length) % charList.length;
                if (e.key === 'ArrowDown') currentIndex = (currentIndex + 1) % charList.length;
                selectedChars.p2 = charList[currentIndex];
                updateCharSelectionUI('p2');
            }
        }
        return;
    }

    switch (e.key) {
        // Player 1
        case 'd': keys.d.pressed = true; break;
        case 'a': keys.a.pressed = true; break;
        case 'w': keys.w.pressed = true; break;
        case '1': player1.attack('basic'); break;
        case '2': player1.attack('heavy'); break;

        // Player 2
        case 'ArrowRight': keys.ArrowRight.pressed = true; break;
        case 'ArrowLeft': keys.ArrowLeft.pressed = true; break;
        case 'ArrowUp': keys.ArrowUp.pressed = true; break;
        case 'n': player2.attack('basic'); break;
        case 'm': player2.attack('heavy'); break;
    }
});

window.addEventListener('keyup', (e) => {
    switch (e.key) {
        case 'd': keys.d.pressed = false; break;
        case 'a': keys.a.pressed = false; break;
        case 'w': keys.w.pressed = false; break;
        case 'ArrowRight': keys.ArrowRight.pressed = false; break;
        case 'ArrowLeft': keys.ArrowLeft.pressed = false; break;
        case 'ArrowUp': keys.ArrowUp.pressed = false; break;
    }
});

function rectangularCollision({ rectangle1, rectangle2 }) {
    return (
        rectangle1.attackBox.position.x + rectangle1.attackBox.width >= rectangle2.position.x &&
        rectangle1.attackBox.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.attackBox.position.y + rectangle1.attackBox.height >= rectangle2.position.y &&
        rectangle1.attackBox.position.y <= rectangle2.position.y + rectangle2.height
    );
}

let timerId;
let timer = 99;
function decreaseTimer() {
    if (timer > 0 && gameStarted) {
        timerId = setTimeout(decreaseTimer, 1000);
        timer--;
        ui.timer.innerText = timer;
    }

    if (timer === 0) {
        determineWinner();
    }
}

function determineWinner() {
    gameStarted = false;
    clearTimeout(timerId);
    ui.gameOverScreen.classList.remove('hidden');

    // Calculate percentage based on their distinct max healths
    const p1Percent = player1.health / player1.maxHealth;
    const p2Percent = player2.health / player2.maxHealth;

    if (p1Percent === p2Percent) {
        ui.winText.innerText = 'Tie!';
    } else if (p1Percent > p2Percent) {
        ui.winText.innerText = 'Player 1 Wins!';
    } else {
        ui.winText.innerText = 'Player 2 Wins!';
    }
}

function updateCooldownUI(player, fillElem, textElem) {
    const stats = CHAR_CLASSES[player.charClass];
    const elapsed = Date.now() - player.lastHeavyAttack;

    if (elapsed < stats.heavyCooldown && player.lastHeavyAttack !== 0) {
        const percent = (elapsed / stats.heavyCooldown) * 100;
        fillElem.style.width = percent + '%';
        textElem.innerText = `Heavy Atk: ${((stats.heavyCooldown - elapsed) / 1000).toFixed(1)}s`;
        fillElem.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
    } else {
        fillElem.style.width = '100%';
        textElem.innerText = `Heavy Atk: Ready`;
        fillElem.style.backgroundColor = '#ffd700';
    }
}

function applyDamageAndKnockback(attacker, defender) {
    const stats = CHAR_CLASSES[attacker.charClass];
    const damage = attacker.attackType === 'heavy' ? stats.heavyDamage : stats.basicDamage;

    defender.health -= damage;
    defender.lastHitReceivedTime = Date.now();

    if (attacker.attackType === 'basic' && defender.charClass === 'healer') {
        defender.healableDamage += damage; // Accumulate healable damage
    }

    // Cap healable damage to the total health lost
    const maxHealable = defender.maxHealth - defender.health;
    if (defender.healableDamage > maxHealable) {
        defender.healableDamage = maxHealable;
    }

    // UI Update
    const defUI = defender.identifier === 'p1' ? ui.p1Health : ui.p2Health;
    defUI.style.width = (Math.max(0, defender.health) / defender.maxHealth * 100) + '%';

    // Knockback
    let kbX = attacker.attackType === 'heavy' ? 10 : 3;
    let kbY = attacker.attackType === 'heavy' ? -5 : -2;

    // Tank knockback is slightly stronger
    if (attacker.charClass === 'tank' && attacker.attackType === 'heavy') {
        kbX = 14; kbY = -6;
    }

    defender.velocity.x = kbX;
    defender.velocity.y = kbY;

    if (attacker.position.x > defender.position.x) {
        defender.velocity.x *= -1; // Correct knockback direction
    }
}

function gameLoop() {
    if (!gameStarted) return;
    window.requestAnimationFrame(gameLoop);

    // Clear canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw platforms
    ctx.fillStyle = '#2c3e50';
    platforms.forEach(platform => {
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });

    // Update and draw players if alive
    if (player1.health > 0) player1.update();
    if (player2.health > 0) player2.update();

    // Update fire spawners (continuous rising fire)
    for (let i = fireSpawners.length - 1; i >= 0; i--) {
        const spawner = fireSpawners[i];
        if (spawner.duration <= 0) {
            fireSpawners.splice(i, 1);
        } else {
            spawner.duration--;
            const fireColors = ['#ff0000', '#ff5a00', '#ff9a00', '#ffce00', '#ffe808'];
            for (let j = 0; j < 4; j++) {
                particles.push(new Particle({
                    position: {
                        x: spawner.x + (Math.random() - 0.5) * 100, // Wide spread
                        y: spawner.y + 20
                    },
                    velocity: {
                        x: (Math.random() - 0.5) * 4,
                        y: (Math.random() - 0.5) * -10 - 6 // Rapidly rise upwards
                    },
                    radius: Math.random() * 14 + 6,
                    color: fireColors[Math.floor(Math.random() * fireColors.length)],
                    lifeSpan: Math.random() * 40 + 20
                }));
            }
        }
    }

    // Update particles (Fire effect)
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        if (particle.opacity <= 0 || particle.radius <= 0) { // Also remove if radius is too small
            particles.splice(i, 1);
        } else {
            particle.update();
        }
    }

    // Player 1 Movement
    player1.velocity.x = 0;
    if (keys.a.pressed && !keys.d.pressed) {
        player1.velocity.x = -player1.speed;
        player1.facingRight = false;
    } else if (keys.d.pressed && !keys.a.pressed) {
        player1.velocity.x = player1.speed;
        player1.facingRight = true;
    }
    // Player 1 Jump
    if (keys.w.pressed && player1.velocity.y === 0) {
        player1.velocity.y = player1.jumpPower;
    }

    // Player 2 Movement
    player2.velocity.x = 0;
    if (keys.ArrowLeft.pressed && !keys.ArrowRight.pressed) {
        player2.velocity.x = -player2.speed;
        player2.facingRight = false;
    } else if (keys.ArrowRight.pressed && !keys.ArrowLeft.pressed) {
        player2.velocity.x = player2.speed;
        player2.facingRight = true;
    }
    // Player 2 Jump
    if (keys.ArrowUp.pressed && player2.velocity.y === 0) {
        player2.velocity.y = player2.jumpPower;
    }

    // Collision Detection and Hit Handling
    // P1 hitting P2
    if (
        rectangularCollision({ rectangle1: player1, rectangle2: player2 }) &&
        player1.isAttacking
    ) {
        player1.isAttacking = false; // Prevent multiple hits
        applyDamageAndKnockback(player1, player2);
    }

    // P2 hitting P1
    if (
        rectangularCollision({ rectangle1: player2, rectangle2: player1 }) &&
        player2.isAttacking
    ) {
        player2.isAttacking = false; // Prevent multiple hits
        applyDamageAndKnockback(player2, player1);
    }

    // Check game over
    if ((player1.health <= 0 || player2.health <= 0) && !isGameOver) {
        isGameOver = true;

        if (player1.diedFromRingOut || player2.diedFromRingOut) {
            // Wait 1.5 seconds to let the fire animation play out before changing screens
            setTimeout(() => {
                if (gameStarted) {
                    determineWinner();
                }
            }, 1500);
        } else {
            // Instant game over for combat deaths
            determineWinner();
        }
    }

    // Update Cooldowns UI
    updateCooldownUI(player1, ui.p1CdFill, ui.p1CdText);
    updateCooldownUI(player2, ui.p2CdFill, ui.p2CdText);
}
