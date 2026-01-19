import { Scene } from "phaser";
import { FiberGameSession } from "../fiber";

interface GameOverSceneInitData {
    points?: number;
    playerPoints?: number;
    bossPoints?: number;
    fiberSession?: FiberGameSession;
}

export class GameOverScene extends Scene {
    end_points: number = 0;
    player_points: number = 0;
    boss_points: number = 0;
    fiberSession: FiberGameSession | null = null;

    constructor() {
        super("GameOverScene");
    }

    init(data: GameOverSceneInitData): void {
        this.cameras.main.fadeIn(1000, 0, 0, 0);
        this.end_points = data.points || 0;
        this.player_points = data.playerPoints || 0;
        this.boss_points = data.bossPoints || 0;
        this.fiberSession = data.fiberSession ?? null;
    }

    create(): void {
        // Backgrounds
        this.add.image(0, 0, "background").setOrigin(0, 0);
        this.add.image(0, this.scale.height, "floor").setOrigin(0, 1);

        // Rectangles to show the text
        // Background rectangles
        this.add
            .rectangle(
                0,
                this.scale.height / 2,
                this.scale.width,
                120,
                0xffffff,
            )
            .setAlpha(0.8)
            .setOrigin(0, 0.5);
        this.add
            .rectangle(
                0,
                this.scale.height / 2 + 105,
                this.scale.width,
                90,
                0x000000,
            )
            .setAlpha(0.8)
            .setOrigin(0, 0.5);

        const gameover_text = this.add.bitmapText(
            this.scale.width / 2,
            this.scale.height / 2,
            "knighthawks",
            "GAME\nOVER",
            62,
            1,
        );
        gameover_text.setOrigin(0.5, 0.5);
        gameover_text.postFX.addShine();

        this.add
            .bitmapText(
                this.scale.width / 2,
                this.scale.height / 2 + 85,
                "pixelfont",
                `Your POINTS: ${this.end_points}`,
                24,
            )
            .setOrigin(0.5, 0.5);

        this.add
            .bitmapText(
                this.scale.width / 2,
                this.scale.height / 2 + 110,
                "pixelfont",
                `GAIN: ${this.player_points} CKB`,
                20,
            )
            .setOrigin(0.5, 0.5);

        this.add
            .bitmapText(
                this.scale.width / 2,
                this.scale.height / 2 + 135,
                "pixelfont",
                `LOSS: ${this.boss_points} CKB`,
                20,
            )
            .setOrigin(0.5, 0.5);

        const createButton = (
            x: number,
            y: number,
            label: string,
            onClick: () => void,
        ) => {
            const button = this.add
                .rectangle(x, y, 140, 40, 0xffffff)
                .setStrokeStyle(2, 0x000000)
                .setOrigin(0.5, 0.5)
                .setInteractive({ useHandCursor: true });
            const text = this.add
                .text(x, y, label, {
                    fontFamily: "sans-serif",
                    fontSize: "22px",
                    color: "#000000",
                })
                .setOrigin(0.5, 0.5)
                .setInteractive({ useHandCursor: true });

            const handleClick = () => {
                onClick();
            };

            button.on("pointerdown", handleClick);
            text.on("pointerdown", handleClick);

            return { button, text };
        };

        const handleReplay = () => {
            this.scene.start("MainScene", {
                fiberSession: this.fiberSession ?? undefined,
            });
        };

        let replayButton:
            | { button: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }
            | null = null;
        let claimButton:
            | { button: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }
            | null = null;

        const handleClaim = async () => {
            if (claimButton) {
                claimButton.text.setText("Waiting...");
                claimButton.button.disableInteractive();
                claimButton.text.disableInteractive();
            }
            if (replayButton) {
                replayButton.button.disableInteractive();
                replayButton.text.disableInteractive();
            }
            try {
                await this.fiberSession?.shutdown();
            } catch (error) {
                console.error("Failed to claim and disconnect:", error);
                if (claimButton) {
                    claimButton.text.setText("CLAIM");
                    claimButton.button.setInteractive({ useHandCursor: true });
                    claimButton.text.setInteractive({ useHandCursor: true });
                }
                if (replayButton) {
                    replayButton.button.setInteractive({ useHandCursor: true });
                    replayButton.text.setInteractive({ useHandCursor: true });
                }
                return;
            }
            this.scene.start("MainScene");
        };

        const buttonY = this.scale.height / 2 + 195;
        replayButton = createButton(
            this.scale.width / 2 - 90,
            buttonY,
            "REPLAY",
            handleReplay,
        );
        claimButton = createButton(
            this.scale.width / 2 + 90,
            buttonY,
            "CLAIM",
            handleClaim,
        );
    }
}
