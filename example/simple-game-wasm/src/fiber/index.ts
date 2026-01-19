import { bytesFrom, Hex } from "@ckb-ccc/core";
import { Fiber, randomSecretKey } from '@nervosnetwork/fiber-js'

export const amountPerPoint = 1 * 10 ** 8; // 1 CKB per point

const nodeRelay = {
    peerId: "QmdzY4DaMZjcB7tW91njRkHj8uootQXyzbFrxXTSVsQqEp",
    address:
        "/ip4/127.0.0.1/tcp/8248/ws/p2p/QmdzY4DaMZjcB7tW91njRkHj8uootQXyzbFrxXTSVsQqEp",
};

const wasmNodePlayer = {
    ckbSecretKey: "0x7ab050ecf4375b1e2faa3c7331c3071582830a07d14c36990b4d3893bddec399"
}

const wasmNodeBoss = {
    ckbSecretKey: "0xe1c4e6d87ed8bb389d625aca2bd600427dab59a5c665ced090698640cf596570"
}

const fundingAmount: Hex = "0xba43b7400";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fiberInitByKey = new Map<string, Promise<Fiber>>();

async function createWasmFiber(ckbSecretKey: string): Promise<Fiber> {
    const cached = fiberInitByKey.get(ckbSecretKey);
    if (cached) {
        return cached;
    }

    const initPromise = (async () => {
        const configPath = '/fiber-config-testnet.yml'

        const response = await fetch(configPath)
        if (!response.ok) {
            throw new Error(`Load fnn-wasm config failed: ${response.statusText}`)
        }

        const config = await response.text()
        const fiberKeyPair = randomSecretKey()
        const ckbKey = bytesFrom(ckbSecretKey);

        const fiber = new Fiber()
        await fiber.start(config, fiberKeyPair, ckbKey, undefined, "error");
        return fiber;
    })();

    fiberInitByKey.set(ckbSecretKey, initPromise);
    try {
        return await initPromise;
    } catch (error) {
        fiberInitByKey.delete(ckbSecretKey);
        throw error;
    }
}

export class FiberGameSession {
    private bossNode: Fiber | null = null;
    private playerNode: Fiber | null = null;
    private bossChannelId: Hex | null = null;
    private playerChannelId: Hex | null = null;
    private teardownPromise: Promise<void> | null = null;

    private async newFiber() {
        const playerNodePromise = this.playerNode
            ? Promise.resolve(this.playerNode)
            : createWasmFiber(wasmNodePlayer.ckbSecretKey);
        const bossNodePromise = this.bossNode
            ? Promise.resolve(this.bossNode)
            : createWasmFiber(wasmNodeBoss.ckbSecretKey);

        const [playerNode, bossNode] = await Promise.all([
            playerNodePromise,
            bossNodePromise,
        ]);

        this.playerNode = playerNode;
        this.bossNode = bossNode;
    }

    private async connectPeer() {
        const isConnected = async (fiber: Fiber) => {
            const peers = await fiber.listPeers();
            return peers?.peers?.some((peer: any) => peer.peer_id === nodeRelay.peerId);
        };

        const [playerConnected, bossConnected] = await Promise.all([
            isConnected(this.playerNode),
            isConnected(this.bossNode),
        ]);
        if (playerConnected && bossConnected) {
            return;
        }

        const connectPromises: Promise<void>[] = [];
        if (!playerConnected) {
            connectPromises.push(this.playerNode.connectPeer({ address: nodeRelay.address }));
        }
        if (!bossConnected) {
            connectPromises.push(this.bossNode.connectPeer({ address: nodeRelay.address }));
        }
        await Promise.all(connectPromises);

        const waitConnect = async (fiber: Fiber) => {
            for (let i = 0; i < 20; i++) {
                const peers = await fiber.listPeers();
                if (peers?.peers?.some((peer: any) => peer.peer_id === nodeRelay.peerId)) {
                    return;
                }
                await sleep(400);
            }
            throw new Error("Peer connection was not established within timeout");
        };

        const waitPromises: Promise<void>[] = [];
        if (!playerConnected) {
            waitPromises.push(waitConnect(this.playerNode));
        }
        if (!bossConnected) {
            waitPromises.push(waitConnect(this.bossNode));
        }
        await Promise.all(waitPromises);
    }

    private async openChannel() {
        const getReadyChannelId = async (fiber: Fiber): Promise<Hex | null> => {
            const { channels } = await fiber.listChannels({ peer_id: nodeRelay.peerId });
            console.log(`----  ${JSON.stringify(channels)}`);
            const readyChannel = channels.find(
                (channel: any) =>
                    channel.peer_id === nodeRelay.peerId &&
                    channel.state?.state_name === "CHANNEL_READY",
            );
            return (readyChannel?.channel_id as Hex) ?? null;
        };

        const [playerReadyId, bossReadyId] = await Promise.all([
            getReadyChannelId(this.playerNode),
            getReadyChannelId(this.bossNode),
        ]);

        if (playerReadyId && bossReadyId) {
            this.playerChannelId = playerReadyId;
            this.bossChannelId = bossReadyId;
            console.log("A channel that has already been opened was used.");
            return;
        }
        if (!playerReadyId) {
            await this.playerNode.openChannel({
                peer_id: nodeRelay.peerId,
                funding_amount: fundingAmount,
                public: false,
            });
        }
        if (!bossReadyId) {
            await this.bossNode.openChannel({
                peer_id: nodeRelay.peerId,
                funding_amount: fundingAmount,
                public: false,
            });
        }

        console.log("Wait fiber channel ready");
        const waitChannelReady = async (fiber: Fiber, existingId: Hex | null): Promise<Hex> => {
            if (existingId) {
                return existingId;
            }
            const deadline = Date.now() + 2 * 60_000;
            while (Date.now() < deadline) {
                const { channels } = await fiber.listChannels({ peer_id: nodeRelay.peerId });
                const readyChannel = channels.find(
                    (channel: any) =>
                        channel.peer_id === nodeRelay.peerId &&
                        channel.state?.state_name === "CHANNEL_READY",
                );
                if (readyChannel?.channel_id) {
                    console.log(`---- channel done: ${JSON.stringify(await fiber.listChannels({}))}`);
                    return readyChannel.channel_id as Hex;
                }
                await sleep(250);
            }
            throw new Error("Channel was not ready within timeout");
        };

        const [playerChannelId, bossChannelId] = await Promise.all([
            waitChannelReady(this.playerNode, playerReadyId),
            waitChannelReady(this.bossNode, bossReadyId),
        ]);
        this.playerChannelId = playerChannelId;
        this.bossChannelId = bossChannelId;
    }

    private async closeChannel(): Promise<void> {
        if (!this.playerNode || !this.bossNode) {
            return;
        }
        const [playerResult, bossResult] = await Promise.all([
            this.playerNode.listChannels({ peer_id: nodeRelay.peerId }),
            this.bossNode.listChannels({ peer_id: nodeRelay.peerId }),
        ]);
        const shutdownSequentially = async (node: Fiber, channels: any[]) => {
            for (const channel of channels) {
                const stateName = channel?.state?.state_name || "";
                // if (!stateName.includes("CHANNEL_READY")) {
                //     continue;
                // }

                console.log(`shutdown Channel : ${channel.channel_id}`);
                try {
                    await node.shutdownChannel({
                        channel_id: channel.channel_id,
                        fee_rate: "0x3FC",
                        close_script: {
                            "code_hash": "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
                            "hash_type": "type",
                            "args": "0xe266ef916081dbf19e13f1a485bbbc2206a01dc1"
                        },
                    });
                } catch (e) { }
            }
        };

        console.log(`---- Player channel (${playerResult.channels.length}): ${JSON.stringify(playerResult.channels)}`);
        await shutdownSequentially(this.playerNode, playerResult.channels || []);

        console.log(`---- Boss   channel (${bossResult.channels.length}): ${JSON.stringify(bossResult.channels)}`);
        await shutdownSequentially(this.bossNode, bossResult.channels || []);
    }

    private async waitClose(): Promise<void> {
        if (!this.playerNode || !this.bossNode) {
            return;
        }
        const deadline = Date.now() + 30_000;
        const isAllClosed = (channels: any[]) =>
            channels.every((channel) => {
                const stateName = String(channel?.state?.state_name || "").toLowerCase();
                return stateName.includes("closed") || stateName.includes("shutdown");
            });

        while (Date.now() < deadline) {
            const [playerResult, bossResult] = await Promise.all([
                this.playerNode.listChannels({ peer_id: nodeRelay.peerId, include_closed: true }),
                this.bossNode.listChannels({ peer_id: nodeRelay.peerId, include_closed: true }),
            ]);
            if (
                isAllClosed(playerResult.channels || []) &&
                isAllClosed(bossResult.channels || [])
            ) {
                return;
            }
            await sleep(200);
        }
        throw new Error("Channels were not closed within timeout");
    }

    async start(): Promise<void> {
        console.log(`Start init fiber(wasm) node`);
        if (this.teardownPromise) {
            await this.teardownPromise;
        }

        if (!this.playerNode || !this.bossNode) {
            await this.newFiber();
        }

        await this.connectPeer();
        await this.openChannel();
    }

    async shutdown(): Promise<void> {
        await this.closeChannel();
        await this.waitClose();
    }

    getNodes() {
        return {
            bossNode: this.bossNode,
            playerNode: this.playerNode,
        };
    }

    getChannelIds() {
        return {
            bossChannelId: this.bossChannelId,
            playerChannelId: this.playerChannelId,
        };
    }

    private requireNodes() {
        if (!this.bossNode || !this.playerNode) {
            throw new Error("Fiber nodes are not ready");
        }
        return { bossNode: this.bossNode, playerNode: this.playerNode };
    }

    async payPlayerPoints(_points: number) {
        this.requireNodes();
        // const amount: Hex = `0x${(amountPerPoint * points).toString(16)}`;

        // const invoice = await playerNode.createCKBInvoice(
        //     amount,
        //     "player hit the boss!",
        // );
        // const result = await bossNode.sendPayment(invoice.invoice_address);
        // console.log(`boss pay player ${points} CKB`);
        // console.log("invoice", invoice);
        // console.log("payment result", result);
    }

    async payBossPoints(_points: number) {
        this.requireNodes();
        // const amount: Hex = `0x${(amountPerPoint * points).toString(16)}`;
        // const invoice = await bossNode.createCKBInvoice(
        //     amount,
        //     "boss hit the player!",
        // );
        // const result = await playerNode.sendPayment(invoice.invoice_address);
        // console.log(`player pay boss ${points} CKB`);
        // console.log("invoice", invoice);
        // console.log("payment result", result);
    }
}
