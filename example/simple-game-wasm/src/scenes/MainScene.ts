import { Scene, Input, Types } from "phaser";
import { Player } from "../gameobjects/Player";
import { BlueEnemy } from "../gameobjects/BlueEnemy";
import { Bullet } from "../gameobjects/Bullet";
import { FiberGameSession } from "../fiber";

enum GameState {
    Idle = "idle",
    Starting = "starting",
    Running = "running",
    Settling = "settling",
}

interface MainSceneInitData {
    fiberSession?: FiberGameSession;
}

export class MainScene extends Scene {
    player: Player | null = null;
    enemy_blue: BlueEnemy | null = null;
    cursors!: Types.Input.Keyboard.CursorKeys;
    fiberSession: FiberGameSession | null = null;
    bossPoints: number = 0;
    playerPoints: number = 0;
    gameState: GameState = GameState.Idle;

    points: number = 0;
    game_over_timeout: number = 5;

    constructor() {
        super("MainScene");
    }

    async init(data: MainSceneInitData = {}): Promise<void> {
        this.cameras.main.fadeIn(1000, 0, 0, 0);
        this.scene.launch("MenuScene");

        // Reset points
        this.points = 0;
        this.bossPoints = 0;
        this.playerPoints = 0;
        this.gameState = GameState.Idle;
        this.registry.set("fiber-ready", false);

        this.fiberSession = data.fiberSession ?? new FiberGameSession();

        this.fiberSession
            .start()
            .then(() => {
                this.registry.set("fiber-ready", true);
                this.game.events.emit("fiber-ready");
            })
            .catch((error) => {
                console.error("Failed to initialize Fiber session:", error);
                this.registry.set("fiber-ready", false);
                this.game.events.emit("fiber-error", error);
            });
    }

    create(): void {
        this.add.image(0, 0, "background").setOrigin(0, 0);
        this.add.image(0, this.scale.height, "floor").setOrigin(0, 1);

        // Player
        this.player = new Player({ scene: this });

        // Enemy
        this.enemy_blue = new BlueEnemy(this);

        // Cursor keys
        this.setupControls();

        // Setup collisions
        this.setupCollisions();

        // This event comes from MenuScene
        this.game.events.on("start-game", async () => {
            if (this.gameState !== GameState.Idle) {
                return;
            }
            this.gameState = GameState.Starting;
            try {
                if (!this.fiberSession) {
                    throw new Error("Fiber session not initialized");
                }
                await this.fiberSession.start();
            } catch (error) {
                console.error(
                    "Cannot start game without ready channels:",
                    error,
                );
                this.gameState = GameState.Idle;
                return;
            }
            this.gameState = GameState.Running;

            this.scene.stop("MenuScene");
            this.scene.launch("HudScene", {
                remaining_time: this.game_over_timeout,
            });

            if (this.player) {
                this.player.start();
            }

            if (this.enemy_blue) {
                this.enemy_blue.start();
            }

            // Game Over timeout
            const countdownEvent = this.time.addEvent({
                delay: 1000,
                loop: true,
                callback: async () => {
                    if (this.game_over_timeout === 0) {
                        this.gameState = GameState.Settling;
                        countdownEvent.remove(false);
                        // You need remove the event listener to avoid duplicate events.
                        this.game.events.removeListener("start-game");
                        // It is necessary to stop the scenes launched in parallel.
                        this.scene.stop("HudScene");

                        this.scene.start("GameOverScene", {
                            points: this.points,
                            playerPoints: this.playerPoints,
                            bossPoints: this.bossPoints,
                            fiberSession: this.fiberSession,
                        });
                    } else {
                        this.game_over_timeout--;
                        const hudScene = this.scene.get("HudScene");
                        if (
                            hudScene &&
                            typeof (hudScene as any).update_timeout ===
                                "function"
                        ) {
                            (hudScene as any).update_timeout(
                                this.game_over_timeout,
                            );
                        }
                    }
                },
            });
        });
    }

    setupControls(): void {
        this.cursors = this.input.keyboard.createCursorKeys();

        // @ts-ignore - We know this.cursors is not null at this point
        this.cursors.space.on("down", () => {
            if (this.player) {
                this.player.fire();
            }
        });

        this.input.on("pointerdown", (pointer: Input.Pointer) => {
            if (this.player) {
                this.player.fire(pointer.x, pointer.y);
            }
        });
    }

    setupCollisions(): void {
        // Overlap enemy with bullets
        if (this.player && this.enemy_blue) {
            this.physics.add.overlap(
                this.player.bullets,
                this.enemy_blue,
                async (_enemy, bullet) => {
                    const typedBullet = bullet as unknown as Bullet;
                    if (
                        typedBullet.destroyBullet &&
                        this.player &&
                        this.enemy_blue
                    ) {
                        typedBullet.destroyBullet();
                        this.enemy_blue.damage(this.player.x, this.player.y);
                        this.points += 10;
                        this.playerPoints += 10;

                        // Call payPlayerPoints when player hits enemy
                        if (this.fiberSession) {
                            try {
                                await this.fiberSession.payPlayerPoints(10);
                            } catch (error) {
                                console.error("Failed to score point:", error);
                            }
                        }

                        const hudScene = this.scene.get("HudScene");
                        if (
                            hudScene &&
                            typeof (hudScene as any).update_points ===
                                "function"
                        ) {
                            (hudScene as any).update_points(this.points);
                        }
                    }
                },
            );

            // Overlap player with enemy bullets
            this.physics.add.overlap(
                this.enemy_blue.bullets,
                this.player,
                async (_player, bullet) => {
                    const typedBullet = bullet as unknown as Bullet;
                    if (typedBullet.destroyBullet) {
                        typedBullet.destroyBullet();
                        this.cameras.main.shake(100, 0.01);
                        this.cameras.main.flash(300, 255, 10, 10, false);
                        this.points -= 10;
                        this.bossPoints += 10;

                        // Call payBossPoints when enemy hits player
                        if (this.fiberSession) {
                            try {
                                await this.fiberSession.payBossPoints(10);
                            } catch (error) {
                                console.error(
                                    "Failed to process lose point:",
                                    error,
                                );
                            }
                        }

                        const hudScene = this.scene.get("HudScene");
                        if (
                            hudScene &&
                            typeof (hudScene as any).update_points ===
                                "function"
                        ) {
                            (hudScene as any).update_points(this.points);
                        }
                    }
                },
            );
        }
    }

    update(): void {
        if (this.player) {
            this.player.update();
        }

        if (this.enemy_blue) {
            this.enemy_blue.update();
        }

        // Player movement entries
        if (this.player) {
            if (this.cursors.up.isDown) {
                this.player.move("up");
            }
            if (this.cursors.down.isDown) {
                this.player.move("down");
            }
        }
    }
}
