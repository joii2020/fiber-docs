import { bytesFrom, Hex, } from "@ckb-ccc/core";
import { FiberNode } from "./node";
import { Fiber, randomSecretKey } from '@nervosnetwork/fiber-js'

export const amountPerPoint = 1 * 10 ** 8; // 1 CKB per point

const node1 = {
    peerId: "QmdW4WGRUfqQ8hx92Uaufx4n3TXrJUoDP666BQwbqiDrnv",
    address:
        "/ip4/127.0.0.1/tcp/8228/p2p/QmdW4WGRUfqQ8hx92Uaufx4n3TXrJUoDP666BQwbqiDrnv",
    url: "/node1-api",
};

const node2 = {
    peerId: "QmcFpUnjRvMyqbFBTn94wwF8LZodvPWpK39Wg9pYr2i4TQ",
    address:
        "/ip4/127.0.0.1/tcp/8238/p2p/QmcFpUnjRvMyqbFBTn94wwF8LZodvPWpK39Wg9pYr2i4TQ",
    url: "/node2-api",
};

const wasmNode1 = {
    ckbSecretKey: "0x7ab050ecf4375b1e2faa3c7331c3071582830a07d14c36990b4d3893bddec399"
}

async function createWasmFiber(): Promise<Fiber> {
    const configPath = '/fiber-config-testnet.yml'

    const response = await fetch(configPath)
    if (!response.ok) {
        throw new Error(`配置文件加载失败: ${response.statusText}`)
    }

    const config = await response.text()
    const fiberKeyPair = randomSecretKey()
    const ckbSecretKey = bytesFrom(wasmNode1.ckbSecretKey);

    const fiber = new Fiber()
    await fiber.start(config, fiberKeyPair, ckbSecretKey, undefined, "info");
    return fiber;
}

export async function prepareNodes() {
    const bossNode = new FiberNode(node1.url, node1.peerId, node1.address);
    const playerNode = new FiberNode(node2.url, node2.peerId, node2.address);
    console.log("bossNode", bossNode);
    console.log("playerNode", playerNode);

    await bossNode.rpc.connectPeer({
        address: playerNode.address,
    });

    const myChannels = await bossNode.rpc.listChannels({
        peer_id: playerNode.peerId,
    });
    const activeChannel = myChannels.channels.filter(
        (channel) => channel.state.state_name === "CHANNEL_READY",
    );
    if (activeChannel.length == 0) {
        console.error("activeChannel is empty");
    }
    return { bossNode, playerNode };
}

export async function payPlayerPoints(
    bossNode: FiberNode,
    playerNode: FiberNode,
    points: number,
) {
    const amount: Hex = `0x${(amountPerPoint * points).toString(16)}`;

    const invoice = await playerNode.createCKBInvoice(
        amount,
        "player hit the boss!",
    );
    const result = await bossNode.sendPayment(invoice.invoice_address);
    console.log(`boss pay player ${points} CKB`);
    console.log("invoice", invoice);
    console.log("payment result", result);
}

export async function payBossPoints(
    bossNode: FiberNode,
    playerNode: FiberNode,
    points: number,
) {
    const amount: Hex = `0x${(amountPerPoint * points).toString(16)}`;
    const invoice = await bossNode.createCKBInvoice(
        amount,
        "boss hit the player!",
    );
    const result = await playerNode.sendPayment(invoice.invoice_address);
    console.log(`player pay boss ${points} CKB`);
    console.log("invoice", invoice);
    console.log("payment result", result);
}
