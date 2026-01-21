import { bytesFrom, hexFrom } from "@ckb-ccc/core";
import { Fiber, randomSecretKey } from "@nervosnetwork/fiber-js";
import type { HexString, InvoiceResult, NewInvoiceParams } from "@nervosnetwork/fiber-js";

export const relayNodeInfo = {
    peerId: "QmdzY4DaMZjcB7tW91njRkHj8uootQXyzbFrxXTSVsQqEp",
    address:
        "/ip4/127.0.0.1/tcp/8248/ws/p2p/QmdzY4DaMZjcB7tW91njRkHj8uootQXyzbFrxXTSVsQqEp",
};

const nodeAKey = "0xac70c6ce96ff0649102612c3938adc501c8f771bff9d900551d34a29a7c59c44";
const nodeBKey = "0x78bd9b4af0552a8292dda617a63c5d1db9b0af9d33c8532882224926e23eb761";
export const defaultNodeKeys = {
    A: nodeAKey,
    B: nodeBKey,
} as const;

const CKB_SHANNONS = 100000000n;
const DEFAULT_FUNDING_AMOUNT = 1000n;
const DEFAULT_FUNDING_AMOUNT_HEX = `0x${(DEFAULT_FUNDING_AMOUNT * CKB_SHANNONS).toString(16)}` as `0x${string}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class Timer {
    private label: string;
    private startAt: number;

    constructor(label: string) {
        this.label = label;
        this.startAt = Timer.now();
    }

    stop() {
        const durationMs = Timer.now() - this.startAt;
        console.log(`${this.label} took ${durationMs.toFixed(2)}ms`);
        return durationMs;
    }

    private static now() {
        return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    }
}

let configPromise: Promise<string> | null = null;
const loadConfig = () => {
    if (!configPromise) {
        configPromise = fetch("/fiber-config-testnet.yml").then(async (response) => {
            if (!response.ok) {
                throw new Error(`Load config failed: ${response.statusText}`);
            }
            return response.text();
        });
    }
    return configPromise;
};

export const isValidKey = (value: string) => /^0x[0-9a-fA-F]{64}$/.test(value.trim());

export class FiberNode {
    private nodeName: string;
    private fiber: Fiber | null = null;

    constructor(name: string) {
        this.nodeName = name;
    }

    hasNode() {
        return this.fiber !== null;
    }

    getFiberKey(): Uint8Array {
        const storageKey = `fiber-key-pair:${this.nodeName}`;
        const storedKey = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null;
        let fiberKeyPair: Uint8Array;
        if (storedKey && isValidKey(storedKey)) {
            fiberKeyPair = bytesFrom(storedKey);
        } else {
            fiberKeyPair = randomSecretKey();
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(storageKey, hexFrom(fiberKeyPair));
            }
        }
        console.log(`fiber key: ${hexFrom(fiberKeyPair)}`);
        return fiberKeyPair;
    }

    async createNode(ckbSecretKey: string) {
        if (this.fiber != null) {
            console.warn(`Node(${this.nodeName}) fiber has been created`);
            return;
        }
        const config = await loadConfig();
        const fiber = new Fiber();

        const fiberKeyPair = this.getFiberKey();
        const ckbKey = bytesFrom(ckbSecretKey);
        const timer = new Timer(`fiber.start ${this.nodeName}`);
        await fiber.start(config, fiberKeyPair, ckbKey, undefined, "error", `/wasm-${this.nodeName}`);
        timer.stop();
        this.fiber = fiber
    }

    async connectRelay() {
        if (!this.fiber) {
            throw new Error("Fiber node not created.");
        }
        await this.fiber.connectPeer({ address: relayNodeInfo.address });

        // wait
        for (let attempt = 0; attempt < 20; attempt += 1) {
            const peers = await this.fiber.listPeers();
            console.log(`${JSON.stringify(peers)}`);
            if (peers?.peers?.some((peer: { peer_id?: string }) => peer.peer_id === relayNodeInfo.peerId)) {
                return;
            }
            await sleep(400);
        }
        throw new Error("Relay connection timed out");
    }

    private async getRelayPubkey() {
        if (!this.fiber) {
            throw new Error("Fiber node not created.");
        }
        const peers = await this.fiber.listPeers();
        const relayPeer = peers?.peers?.find((peer) => peer.peer_id === relayNodeInfo.peerId);
        if (!relayPeer?.pubkey) {
            throw new Error("Relay public key not found.");
        }
        return relayPeer.pubkey;
    }

    async sendRelayFunds(amountCkb: bigint) {
        if (!this.fiber) {
            throw new Error("Fiber node not created.");
        }
        const relayPubkey = await this.getRelayPubkey();
        const amountHex = `0x${(amountCkb * CKB_SHANNONS).toString(16)}` as `0x${string}`;
        await this.fiber.sendPayment({
            target_pubkey: relayPubkey,
            amount: amountHex,
            keysend: true,
        });
    }

    async openChannel() {
        if (!this.fiber) {
            throw new Error("Fiber node not created.");
        }
        await this.fiber.openChannel({
            peer_id: relayNodeInfo.peerId,
            funding_amount: DEFAULT_FUNDING_AMOUNT_HEX,
            public: true,
        });
    }

    async listChannels() {
        if (!this.fiber) {
            return [];
        }
        const result = await this.fiber.listChannels({});
        console.log(`${JSON.stringify(result)}`);
        return result?.channels ?? [];
    }

    async newInvoice(
        preimage: HexString,
        amount: bigint,
        expiry: bigint | null,
        description: string,
    ): Promise<InvoiceResult> {
        if (!this.fiber) {
            throw new Error("Fiber node not created.");
        }
        if (amount <= 0) {
            throw new Error(`Amount(${amount}) failed`);
        }
        if (expiry != null && expiry <= 0n) {
            throw new Error(`Expiry(${expiry}) failed`);
        }

        const params: NewInvoiceParams = {
            amount: `0x${amount.toString(16)}`,
            currency: "Fibt",
            payment_preimage: preimage,
            hash_algorithm: "sha256",
        };
        if (description) {
            params.description = description;
        }
        if (expiry != null) {
            params.expiry = `0x${expiry.toString(16)}`;
        }

        let res = await this.fiber.newInvoice(params);
        console.log(`newInvoice: ${JSON.stringify(res)}`);
        return res;
    }

    async parseInvoice(invoice: string) {
        if (!this.fiber) {
            throw new Error("Fiber node not created.");
        }
        return await this.fiber.parseInvoice({ invoice });
    }

    async sendPayment(invoice: string) {
        if (!this.fiber) {
            throw new Error("Fiber node not created.");
        }
        const timer = new Timer(`fiber.sendPayment ${this.nodeName}`);
        let res = await this.fiber.sendPayment({ invoice });
        timer.stop();
        console.log(`sendPayment: ${JSON.stringify(res)}`);
        return res;
    }

    async shutdownChannel(channelId: HexString) {
        if (!this.fiber) {
            throw new Error("Fiber node not created.");
        }
        await this.fiber.shutdownChannel({
            channel_id: channelId,
            fee_rate: "0x3FC",
            close_script: {
                "code_hash": "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
                "hash_type": "type",
                "args": "0xcc015401df73a3287d8b2b19f0cc23572ac8b14d"
            },
        });
    }

    async stopNode() {
        if (!this.fiber) {
            return;
        }
        const timer = new Timer(`fiber.stop ${this.nodeName}`);
        await this.fiber.stop();
        timer.stop();

        this.fiber = null;
    }
}
