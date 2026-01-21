import "./style.css";
import type { Channel, CkbInvoice } from "@nervosnetwork/fiber-js";
import { FiberNode, defaultNodeKeys, isValidKey, relayNodeInfo } from "./fiber";
import { sleep } from "@ckb-ccc/core";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
    throw new Error("Missing app container");
}

app.innerHTML = `
    <div class="page">
        <header class="hero">
            <span class="eyebrow">Fiber WASM Demo</span>
            <div class="hero-actions">
                <button class="primary" data-role="create-all">Init Both</button>
                <button class="secondary" data-role="fund-relay" title="Debug-only: funds the relay node with test liquidity; normally not required in production." disabled>Fund Relay(DBG)</button>
            </div>
        </header>
        <section class="grid">
            <article class="card relay" data-delay="0">
                <div class="card-header">
                    <h2>Relay Node</h2>
                    <span class="status is-ready">Ready</span>
                </div>
                <div class="relay-tags">
                    <span class="tag">Shared Relay</span>
                    <span class="tag">Testnet</span>
                </div>
                <div class="relay-meta">
                    <div class="label">Peer ID</div>
                    <div>${relayNodeInfo.peerId}</div>
                    <div class="label">Address</div>
                    <div>${relayNodeInfo.address}</div>
                </div>
            </article>
            <article class="card node" data-node="left" data-delay="1">
                <div class="card-header">
                    <h2>Node A</h2>
                    <span class="status" data-role="status">Idle</span>
                </div>
                <label class="field">
                    <span>CKB Secret Key</span>
                    <input type="text" placeholder="0x..." data-role="key-input" autocomplete="off" />
                </label>
                <div class="actions">
                    <button data-role="create-connect">Init Node</button>
                    <button data-role="create-invoice">New Invoice</button>
                    <button data-role="pay-invoice">Payment</button>
                </div>
                <div class="meta" data-role="hint">Enter a 0x-prefixed 32-byte key to start.</div>
                <div class="channels" data-role="channels">
                    <div class="channels-header">
                        <span>Channels</span>
                        <div class="channels-actions">
                            <span class="channels-count" data-role="channel-count">0</span>
                            <button class="channel-refresh" data-role="refresh-channels" type="button" aria-label="Refresh channels">
                                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M20 12a8 8 0 1 1-2.35-5.65l-1.9 1.9H21V2.5l-1.8 1.8A10 10 0 1 0 22 12h-2Z" />
                                </svg>
                            </button>
                            <button class="channel-button" data-role="create-channel" type="button">New</button>
                        </div>
                    </div>
                    <div class="channel-empty" data-role="channel-empty">Connect to relay to load channels.</div>
                    <ul class="channel-list" data-role="channel-list"></ul>
                </div>
            </article>
            <article class="card node" data-node="right" data-delay="2">
                <div class="card-header">
                    <h2>Node B</h2>
                    <span class="status" data-role="status">Idle</span>
                </div>
                <label class="field">
                    <span>CKB Secret Key</span>
                    <input type="text" placeholder="0x..." data-role="key-input" autocomplete="off" />
                </label>
                <div class="actions">
                    <button data-role="create-connect">Init Node</button>
                    <button data-role="create-invoice">New Invoice</button>
                    <button data-role="pay-invoice">Payment</button>
                </div>
                <div class="meta" data-role="hint">Waiting for node setup.</div>
                <div class="channels" data-role="channels">
                    <div class="channels-header">
                        <span>Channels</span>
                        <div class="channels-actions">
                            <span class="channels-count" data-role="channel-count">0</span>
                            <button class="channel-refresh" data-role="refresh-channels" type="button" aria-label="Refresh channels">
                                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M20 12a8 8 0 1 1-2.35-5.65l-1.9 1.9H21V2.5l-1.8 1.8A10 10 0 1 0 22 12h-2Z" />
                                </svg>
                            </button>
                            <button class="channel-button" data-role="create-channel" type="button">New</button>
                        </div>
                    </div>
                    <div class="channel-empty" data-role="channel-empty">Connect to relay to load channels.</div>
                    <ul class="channel-list" data-role="channel-list"></ul>
                </div>
            </article>
        </section>
    </div>
    <div class="modal" data-role="invoice-modal" aria-hidden="true">
        <div class="modal-backdrop" data-role="invoice-close"></div>
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="invoice-title">
            <div class="modal-header">
                <h3 id="invoice-title">New Invoice</h3>
                <button class="modal-close" type="button" data-role="invoice-close" aria-label="Close">
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-row">
                    <span class="modal-label">Channel ID</span>
                    <span class="modal-value" data-role="invoice-channel"></span>
                </div>
                <div class="modal-row">
                    <span class="modal-label">Payment Preimage</span>
                    <span class="modal-value mono" data-role="invoice-preimage"></span>
                </div>
                <form class="modal-form" data-role="invoice-form">
                    <label class="field">
                        <span>Amount <em>ckb</em></span>
                        <input type="text" placeholder="0.01" autocomplete="off" data-role="invoice-amount" required />
                    </label>
                    <label class="field">
                        <span>Expiry <em>seconds</em></span>
                        <input type="number" placeholder="3600" autocomplete="off" data-role="invoice-expiry" />
                    </label>
                    <label class="field">
                        <span>Description</span>
                        <input type="text" placeholder="Optional note" autocomplete="off" data-role="invoice-description" />
                    </label>
                    <div class="modal-actions">
                        <button class="secondary" type="button" data-role="invoice-cancel">Cancel</button>
                        <button type="submit" data-role="invoice-submit">New Invoice</button>
                    </div>
                </form>
                <div class="modal-result" data-role="invoice-result" hidden>
                    <div class="modal-label">Invoice Address</div>
                    <div class="modal-value" data-role="invoice-address"></div>
                </div>
                <div class="modal-hint" data-role="invoice-hint"></div>
            </div>
        </div>
    </div>
    <div class="modal" data-role="payment-modal" aria-hidden="true">
        <div class="modal-backdrop" data-role="payment-close"></div>
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="payment-title">
            <div class="modal-header">
                <h3 id="payment-title">Payment</h3>
                <button class="modal-close" type="button" data-role="payment-close" aria-label="Close">
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <form class="modal-form" data-role="payment-form">
                    <label class="field">
                        <span>Invoice</span>
                        <input type="text" placeholder="fib..." autocomplete="off" data-role="payment-invoice" required />
                    </label>
                    <div class="modal-actions">
                        <button class="secondary" type="button" data-role="payment-parse">Get Info</button>
                        <button type="submit" data-role="payment-submit">Pay</button>
                    </div>
                </form>
                <div class="modal-result" data-role="payment-info" hidden>
                    <div class="modal-label">Invoice Info</div>
                    <div class="modal-value mono pre" data-role="payment-info-text"></div>
                </div>
                <div class="modal-result" data-role="payment-result" hidden>
                    <div class="modal-label">Payment Result</div>
                    <div class="modal-value mono pre" data-role="payment-result-text"></div>
                </div>
                <div class="modal-hint" data-role="payment-hint"></div>
            </div>
        </div>
    </div>
`;

type NodeStatus = "idle" | "creating" | "ready" | "connecting" | "connected" | "error";

const CKB_SHANNONS = 100000000n;

const randomHex32 = (): `0x${string}` => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

const parseCkbToShannons = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (!/^\d+(\.\d{0,8})?$/.test(trimmed)) {
        return null;
    }
    const [whole, fraction = ""] = trimmed.split(".");
    const paddedFraction = (fraction + "00000000").slice(0, 8);
    return BigInt(whole) * CKB_SHANNONS + BigInt(paddedFraction);
};

const formatShannonsToCkb = (value: bigint) => {
    const whole = value / CKB_SHANNONS;
    const fraction = value % CKB_SHANNONS;
    if (fraction === 0n) {
        return whole.toString();
    }
    const trimmed = fraction.toString().padStart(8, "0").replace(/0+$/, "");
    return `${whole}.${trimmed}`;
};

const formatInvoiceInfo = (invoice: CkbInvoice) => {
    let description = "";
    let expiryHex = "";
    invoice.data.attrs.forEach((attr) => {
        if ("Description" in attr) {
            description = attr.Description;
        }
        if ("ExpiryTime" in attr) {
            expiryHex = attr.ExpiryTime;
        }
    });
    const amountHex = invoice.amount;
    let amountCkb = "";
    if (amountHex) {
        try {
            amountCkb = formatShannonsToCkb(BigInt(amountHex));
        } catch {
            amountCkb = amountHex;
        }
    }
    let expiryText = "";
    if (expiryHex) {
        try {
            expiryText = `${BigInt(expiryHex)}s`;
        } catch {
            expiryText = expiryHex;
        }
    }
    const rows = [
        `Currency: ${invoice.currency}`,
        amountHex ? `Amount: ${amountCkb} CKB` : "Amount: -",
        `Payment Hash: ${invoice.data.payment_hash}`,
        description ? `Description: ${description}` : "Description: -",
        expiryText ? `Expiry: ${expiryText}` : "Expiry: -",
    ];
    return rows.join("\n");
};

const setupModalEvents = (
    modalEl: HTMLDivElement,
    closeEls: HTMLElement[],
    onClose?: () => void,
) => {
    const close = () => {
        modalEl.classList.remove("is-open");
        modalEl.setAttribute("aria-hidden", "true");
        if (onClose) {
            onClose();
        }
    };

    const open = () => {
        modalEl.classList.add("is-open");
        modalEl.setAttribute("aria-hidden", "false");
    };

    closeEls.forEach((el) => el.addEventListener("click", close));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modalEl.classList.contains("is-open")) {
            close();
        }
    });

    return { open, close };
};

const setupInvoiceModal = () => {
    const modalEl = document.querySelector<HTMLDivElement>("[data-role='invoice-modal']");
    const closeEls = Array.from(
        document.querySelectorAll<HTMLElement>("[data-role='invoice-close']"),
    );
    const cancelBtn = document.querySelector<HTMLButtonElement>("[data-role='invoice-cancel']");
    const formEl = document.querySelector<HTMLFormElement>("[data-role='invoice-form']");
    const channelEl = document.querySelector<HTMLSpanElement>("[data-role='invoice-channel']");
    const preimageEl = document.querySelector<HTMLSpanElement>("[data-role='invoice-preimage']");
    const amountInput = document.querySelector<HTMLInputElement>("[data-role='invoice-amount']");
    const expiryInput = document.querySelector<HTMLInputElement>("[data-role='invoice-expiry']");
    const descriptionInput = document.querySelector<HTMLInputElement>("[data-role='invoice-description']");
    const submitBtn = document.querySelector<HTMLButtonElement>("[data-role='invoice-submit']");
    const resultEl = document.querySelector<HTMLDivElement>("[data-role='invoice-result']");
    const addressEl = document.querySelector<HTMLDivElement>("[data-role='invoice-address']");
    const hintEl = document.querySelector<HTMLDivElement>("[data-role='invoice-hint']");

    if (
        !modalEl ||
        !closeEls.length ||
        !cancelBtn ||
        !formEl ||
        !channelEl ||
        !preimageEl ||
        !amountInput ||
        !expiryInput ||
        !descriptionInput ||
        !submitBtn ||
        !resultEl ||
        !addressEl ||
        !hintEl
    ) {
        throw new Error("Missing invoice modal elements");
    }

    let activeFiber: FiberNode | null = null;
    let activePreimage: `0x${string}` = randomHex32();

    const modalControls = setupModalEvents(modalEl, [...closeEls, cancelBtn], () => {
        activeFiber = null;
    });

    const openModal = (channelId: string, fiberClient: FiberNode) => {
        activeFiber = fiberClient;
        activePreimage = randomHex32();
        channelEl.textContent = channelId;
        preimageEl.textContent = activePreimage;
        amountInput.value = "";
        expiryInput.value = "";
        descriptionInput.value = "";
        hintEl.textContent = "";
        resultEl.hidden = true;
        submitBtn.disabled = false;
        modalControls.open();
        amountInput.focus();
    };

    formEl.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!activeFiber) {
            hintEl.textContent = "Fiber node not ready.";
            return;
        }
        const amountShannons = parseCkbToShannons(amountInput.value);
        if (amountShannons === null || amountShannons <= 0n) {
            hintEl.textContent = "Amount must be a positive number (up to 8 decimals).";
            return;
        }
        const expiryValue = expiryInput.value.trim();
        let expirySeconds: bigint | null = null;
        if (expiryValue) {
            const expiryNumber = Number.parseInt(expiryValue, 10);
            if (Number.isNaN(expiryNumber) || expiryNumber <= 0) {
                hintEl.textContent = "Expiry must be a positive integer.";
                return;
            }
            expirySeconds = BigInt(expiryNumber);
        }
        const descriptionValue = descriptionInput.value.trim();

        submitBtn.disabled = true;
        hintEl.textContent = "Creating invoice...";
        try {
            const result = await activeFiber.newInvoice(
                activePreimage,
                amountShannons,
                expirySeconds,
                descriptionValue,
            );
            addressEl.textContent = result.invoice_address;
            resultEl.hidden = false;
            hintEl.textContent = "Invoice created.";
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create invoice.";
            hintEl.textContent = message;
            resultEl.hidden = true;
        } finally {
            submitBtn.disabled = false;
        }
    });

    return { openModal };
};

const invoiceModal = setupInvoiceModal();

const setupPaymentModal = () => {
    const modalEl = document.querySelector<HTMLDivElement>("[data-role='payment-modal']");
    const closeEls = Array.from(
        document.querySelectorAll<HTMLElement>("[data-role='payment-close']"),
    );
    const formEl = document.querySelector<HTMLFormElement>("[data-role='payment-form']");
    const invoiceInput = document.querySelector<HTMLInputElement>("[data-role='payment-invoice']");
    const parseBtn = document.querySelector<HTMLButtonElement>("[data-role='payment-parse']");
    const submitBtn = document.querySelector<HTMLButtonElement>("[data-role='payment-submit']");
    const infoEl = document.querySelector<HTMLDivElement>("[data-role='payment-info']");
    const infoTextEl = document.querySelector<HTMLDivElement>("[data-role='payment-info-text']");
    const resultEl = document.querySelector<HTMLDivElement>("[data-role='payment-result']");
    const resultTextEl = document.querySelector<HTMLDivElement>("[data-role='payment-result-text']");
    const hintEl = document.querySelector<HTMLDivElement>("[data-role='payment-hint']");

    if (
        !modalEl ||
        !closeEls.length ||
        !formEl ||
        !invoiceInput ||
        !parseBtn ||
        !submitBtn ||
        !infoEl ||
        !infoTextEl ||
        !resultEl ||
        !resultTextEl ||
        !hintEl
    ) {
        throw new Error("Missing payment modal elements");
    }

    let activeFiber: FiberNode | null = null;
    const modalControls = setupModalEvents(modalEl, closeEls, () => {
        activeFiber = null;
    });

    const openModal = (fiberClient: FiberNode) => {
        activeFiber = fiberClient;
        invoiceInput.value = "";
        hintEl.textContent = "";
        infoEl.hidden = true;
        resultEl.hidden = true;
        submitBtn.disabled = false;
        parseBtn.disabled = false;
        modalControls.open();
        invoiceInput.focus();
    };

    const getInvoiceValue = () => invoiceInput.value.trim();

    const onParse = async () => {
        if (!activeFiber) {
            hintEl.textContent = "Fiber node not ready.";
            return;
        }
        const invoice = getInvoiceValue();
        if (!invoice) {
            hintEl.textContent = "Enter an invoice to parse.";
            return;
        }
        parseBtn.disabled = true;
        submitBtn.disabled = true;
        hintEl.textContent = "Parsing invoice...";
        resultEl.hidden = true;
        try {
            const parsed = await activeFiber.parseInvoice(invoice);
            infoTextEl.textContent = formatInvoiceInfo(parsed.invoice);
            infoEl.hidden = false;
            hintEl.textContent = "Invoice parsed.";
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to parse invoice.";
            hintEl.textContent = message;
            infoEl.hidden = true;
        } finally {
            parseBtn.disabled = false;
            submitBtn.disabled = false;
        }
    };

    parseBtn.addEventListener("click", onParse);

    formEl.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!activeFiber) {
            hintEl.textContent = "Fiber node not ready.";
            return;
        }
        const invoice = getInvoiceValue();
        if (!invoice) {
            hintEl.textContent = "Enter an invoice to pay.";
            return;
        }
        submitBtn.disabled = true;
        parseBtn.disabled = true;
        hintEl.textContent = "Sending payment...";
        try {
            const result = await activeFiber.sendPayment(invoice);
            resultTextEl.textContent = [
                `Payment Hash: ${result.payment_hash}`,
                `Status: ${result.status}`,
                `Fee: ${result.fee}`,
            ].join("\n");
            resultEl.hidden = false;
            hintEl.textContent = "Payment sent.";
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to send payment.";
            hintEl.textContent = message;
            resultEl.hidden = true;
        } finally {
            submitBtn.disabled = false;
            parseBtn.disabled = false;
        }
    });

    return { openModal };
};

const paymentModal = setupPaymentModal();

const setupNodeCard = (
    card: HTMLElement,
    fiberClient: FiberNode,
    onManualInit?: () => void,
    onStateUpdate?: (state: { status: NodeStatus; channels: Channel[] }) => void,
) => {
    const statusEl = card.querySelector<HTMLSpanElement>("[data-role='status']");
    const inputEl = card.querySelector<HTMLInputElement>("[data-role='key-input']");
    const createConnectBtn = card.querySelector<HTMLButtonElement>("[data-role='create-connect']");
    const hintEl = card.querySelector<HTMLDivElement>("[data-role='hint']");
    const createInvoiceBtn = card.querySelector<HTMLButtonElement>("[data-role='create-invoice']");
    const payInvoiceBtn = card.querySelector<HTMLButtonElement>("[data-role='pay-invoice']");
    const channelsEl = card.querySelector<HTMLDivElement>("[data-role='channels']");
    const channelListEl = card.querySelector<HTMLUListElement>("[data-role='channel-list']");
    const channelEmptyEl = card.querySelector<HTMLDivElement>("[data-role='channel-empty']");
    const channelCountEl = card.querySelector<HTMLSpanElement>("[data-role='channel-count']");
    const createChannelBtn = card.querySelector<HTMLButtonElement>("[data-role='create-channel']");
    const refreshChannelsBtn = card.querySelector<HTMLButtonElement>("[data-role='refresh-channels']");

    if (
        !statusEl ||
        !inputEl ||
        !createConnectBtn ||
        !hintEl ||
        !createInvoiceBtn ||
        !payInvoiceBtn ||
        !channelsEl ||
        !channelListEl ||
        !channelEmptyEl ||
        !channelCountEl ||
        !createChannelBtn ||
        !refreshChannelsBtn
    ) {
        throw new Error("Missing node UI elements");
    }

    const nodeRole = card.dataset.node;
    if (nodeRole === "left") {
        inputEl.value = defaultNodeKeys.A;
    } else if (nodeRole === "right") {
        inputEl.value = defaultNodeKeys.B;
    }

    let status: NodeStatus = "idle";
    let isCreatingChannel = false;
    let isRefreshingChannels = false;
    let isStoppingNode = false;
    let latestChannels: Channel[] = [];

    const notifyState = () => {
        if (onStateUpdate) {
            onStateUpdate({ status, channels: latestChannels });
        }
    };

    const clearChannels = (message: string) => {
        channelListEl.innerHTML = "";
        channelEmptyEl.textContent = message;
        channelEmptyEl.hidden = false;
        channelCountEl.textContent = "0";
        latestChannels = [];
        notifyState();
    };

    const renderChannels = (channels: Channel[]) => {
        latestChannels = channels;
        channelListEl.innerHTML = "";
        channelCountEl.textContent = String(channels.length);
        if (channels.length === 0) {
            channelEmptyEl.textContent = "No channels yet.";
            channelEmptyEl.hidden = false;
            notifyState();
            return;
        }
        channelEmptyEl.textContent = "";
        channelEmptyEl.hidden = true;
        channels.forEach((channel) => {
            const item = document.createElement("li");
            item.className = "channel-item";

            const idRow = document.createElement("div");
            idRow.className = "channel-id-row";

            const id = document.createElement("div");
            id.className = "channel-id";

            const idText = document.createElement("span");
            idText.className = "channel-id-text";
            idText.textContent = channel.channel_id;

            const copyButton = document.createElement("button");
            copyButton.className = "channel-copy";
            copyButton.type = "button";
            copyButton.setAttribute("aria-label", "Copy channel id");
            copyButton.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M8.5 7.5h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Zm-1-4h8a2 2 0 0 1 2 2v1.5h-1.5V5.5a.5.5 0 0 0-.5-.5h-8a.5.5 0 0 0-.5.5v9H5.5v-9a2 2 0 0 1 2-2Z" />
                </svg>
            `;
            copyButton.addEventListener("click", async () => {
                const value = channel.channel_id;
                if (navigator.clipboard?.writeText) {
                    try {
                        await navigator.clipboard.writeText(value);
                        return;
                    } catch {
                        // Fallback below.
                    }
                }
                const helper = document.createElement("textarea");
                helper.value = value;
                helper.setAttribute("readonly", "true");
                helper.style.position = "absolute";
                helper.style.left = "-9999px";
                document.body.appendChild(helper);
                helper.select();
                document.execCommand("copy");
                document.body.removeChild(helper);
            });

            const closeButton = document.createElement("button");
            closeButton.className = "channel-close";
            closeButton.type = "button";
            closeButton.textContent = "Close";
            closeButton.addEventListener("click", async () => {
                if (!fiberClient.hasNode() || status !== "connected") {
                    hintEl.textContent = "Connect to relay before closing a channel.";
                    return;
                }
                closeButton.disabled = true;
                hintEl.textContent = "Closing channel...";
                try {
                    await fiberClient.shutdownChannel(channel.channel_id);
                    hintEl.textContent = "Channel shutdown requested.";
                    await refreshChannels();
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to close channel.";
                    hintEl.textContent = message;
                } finally {
                    closeButton.disabled = false;
                }
            });

            // todo 这个按钮移动到 Creatre Node & Content 旁边，样式与其一样
            id.append(idText);
            idRow.append(id, copyButton, closeButton);

            const statusLine = document.createElement("div");
            statusLine.className = "channel-meta";
            statusLine.textContent = `Status: ${channel.state.state_name}`;

            const balanceLine = document.createElement("div");
            balanceLine.className = "channel-meta";
            const localBalanceCkb = BigInt(channel.local_balance) / CKB_SHANNONS;
            const remoteBalanceCkb = BigInt(channel.remote_balance) / CKB_SHANNONS;
            balanceLine.textContent = `Balance: ${localBalanceCkb} / ${remoteBalanceCkb}`;

            item.append(idRow, statusLine, balanceLine);
            channelListEl.appendChild(item);
        });
        notifyState();
    };

    const refreshChannels = async () => {
        if (!fiberClient.hasNode()) {
            return;
        }
        isRefreshingChannels = true;
        refreshChannelsBtn.classList.add("is-spinning");
        updateActions();
        channelEmptyEl.textContent = "Loading channels...";
        channelEmptyEl.hidden = false;
        channelListEl.innerHTML = "";
        try {
            const channels = await fiberClient.listChannels();
            renderChannels(channels);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load channels.";
            clearChannels(message);
        } finally {
            isRefreshingChannels = false;
            refreshChannelsBtn.classList.remove("is-spinning");
            updateActions();
        }
    };

    const setStatus = (next: NodeStatus, message?: string) => {
        status = next;
        const labelMap: Record<NodeStatus, string> = {
            idle: "Idle",
            creating: "Creating",
            ready: "Ready",
            connecting: "Connecting",
            connected: "Connected",
            error: "Error",
        };
        statusEl.textContent = labelMap[next];
        statusEl.classList.toggle("is-ready", next === "ready");
        statusEl.classList.toggle("is-connected", next === "connected");
        statusEl.classList.toggle("is-busy", next === "creating" || next === "connecting");
        if (message) {
            hintEl.textContent = message;
        }
        if (next !== "connected") {
            clearChannels("Connect to relay to load channels.");
        }
        updateActions();
        notifyState();
    };

    const updateActions = () => {
        const keyOk = isValidKey(inputEl.value);
        const hasNode = fiberClient.hasNode();
        const isBusy = status === "creating" || status === "connecting" || isStoppingNode;
        const needsKey = !hasNode && !keyOk;
        if (status === "connected") {
            createConnectBtn.textContent = "Stop Node";
            createConnectBtn.disabled = isBusy;
        } else {
            createConnectBtn.textContent = "Init Node";
            createConnectBtn.disabled = isBusy || needsKey;
        }
        createChannelBtn.disabled = status !== "connected" || !hasNode || isCreatingChannel;
        refreshChannelsBtn.disabled = status !== "connected" || !hasNode || isRefreshingChannels;
        createInvoiceBtn.disabled = status !== "connected" || !hasNode || latestChannels.length === 0;
        payInvoiceBtn.disabled = status !== "connected" || !hasNode;
    };

    const ensureConnected = (message: string) => {
        if (!fiberClient.hasNode() || status !== "connected") {
            hintEl.textContent = message;
            return false;
        }
        return true;
    };

    const onCreateConnect = async () => {
        if (status === "connected") {
            return;
        }
        if (!fiberClient.hasNode()) {
            if (!isValidKey(inputEl.value)) {
                setStatus("error", "Key must be 0x + 64 hex chars.");
                return;
            }
            setStatus("creating", "Starting WASM fiber node...");
            try {
                await fiberClient.createNode(inputEl.value.trim());
                setStatus("ready", "Node created. Ready to connect.");
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to create node.";
                setStatus("error", message);
                return;
            }
        }
        setStatus("connecting", "Connecting to relay...");
        try {
            await fiberClient.connectRelay();
            setStatus("connected", "Relay connected.");
            await refreshChannels();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to connect relay.";
            setStatus("error", message);
        }
    };

    const onStopNode = async () => {
        if (!fiberClient.hasNode()) {
            setStatus("idle", "Node already stopped.");
            return;
        }
        isStoppingNode = true;
        setStatus("creating", "Stopping node...");
        try {
            await fiberClient.stopNode();
            setStatus("idle", "Node stopped.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to stop node.";
            setStatus("error", message);
        } finally {
            isStoppingNode = false;
            updateActions();
        }
    };

    const onCreateChannel = async () => {
        if (!ensureConnected("Connect to relay before creating a channel.")) {
            return;
        }
        isCreatingChannel = true;
        channelEmptyEl.textContent = "Creating channel...";
        channelEmptyEl.hidden = false;
        updateActions();
        try {
            await fiberClient.openChannel();
            hintEl.textContent = "Channel request sent.";
            await refreshChannels();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create channel.";
            hintEl.textContent = message;
        } finally {
            isCreatingChannel = false;
            updateActions();
        }
    };

    const onCreateInvoice = () => {
        if (!ensureConnected("Connect to relay before creating an invoice.")) {
            return;
        }
        if (latestChannels.length === 0) {
            hintEl.textContent = "Create a channel before creating an invoice.";
            return;
        }
        invoiceModal.openModal(latestChannels[0].channel_id, fiberClient);
    };

    const onPayInvoice = () => {
        if (!ensureConnected("Connect to relay before paying an invoice.")) {
            return;
        }
        paymentModal.openModal(fiberClient);
    };

    inputEl.addEventListener("input", () => {
        if (status === "error") {
            setStatus("idle", "Enter a 0x-prefixed 32-byte key to start.");
        }
        updateActions();
    });
    createConnectBtn.addEventListener("click", () => {
        if (status === "connected") {
            void onStopNode();
            return;
        }
        if (onManualInit) {
            onManualInit();
        }
        void onCreateConnect();
    });
    createChannelBtn.addEventListener("click", onCreateChannel);
    createInvoiceBtn.addEventListener("click", onCreateInvoice);
    payInvoiceBtn.addEventListener("click", onPayInvoice);
    refreshChannelsBtn.addEventListener("click", refreshChannels);

    updateActions();
    clearChannels("Connect to relay to load channels.");

    return {
        createAndConnect: onCreateConnect,
        refreshChannels,
    };
};

const createAllBtn = document.querySelector<HTMLButtonElement>("[data-role='create-all']");
const fundRelayBtn = document.querySelector<HTMLButtonElement>("[data-role='fund-relay']");
const nodeCards = Array.from(document.querySelectorAll<HTMLElement>(".node"));
const fiberNodes = {
    left: new FiberNode("A"),
    right: new FiberNode("B"),
} as const;

if (!createAllBtn || !fundRelayBtn) {
    throw new Error("Missing action buttons.");
}

let isManualInitStarted = false;
const disableInitBoth = () => {
    if (!isManualInitStarted) {
        isManualInitStarted = true;
        createAllBtn.disabled = true;
    }
};

type NodeSnapshot = { status: NodeStatus; channels: Channel[] };
const nodeSnapshots: Record<keyof typeof fiberNodes, NodeSnapshot> = {
    left: { status: "idle", channels: [] },
    right: { status: "idle", channels: [] },
};
let relayFundTriggered = false;

const hasReadyChannel = (channels: Channel[]) =>
    channels.some((channel) => channel.state?.state_name === "CHANNEL_READY");

const hasZeroRemoteBalance = (channels: Channel[]) =>
    channels.some((channel) => {
        if (channel.state?.state_name !== "CHANNEL_READY") {
            return false;
        }
        try {
            return BigInt(channel.remote_balance) === 0n;
        } catch {
            return false;
        }
    });

const updateRelayFundAction = () => {
    if (relayFundTriggered) {
        fundRelayBtn.disabled = true;
        return;
    }
    const leftSnapshot = nodeSnapshots.left;
    const rightSnapshot = nodeSnapshots.right;
    const bothConnected = leftSnapshot.status === "connected" && rightSnapshot.status === "connected";
    const bothReady = hasReadyChannel(leftSnapshot.channels) && hasReadyChannel(rightSnapshot.channels);
    const needsFund =
        hasZeroRemoteBalance(leftSnapshot.channels) || hasZeroRemoteBalance(rightSnapshot.channels);
    fundRelayBtn.disabled = !(bothConnected && bothReady && needsFund);
};

const nodeControllers = nodeCards.map((card) => {
    const nodeRole = card.dataset.node;
    if (!nodeRole || !(nodeRole in fiberNodes)) {
        throw new Error("Unknown node role.");
    }
    const roleKey = nodeRole as keyof typeof fiberNodes;
    return setupNodeCard(card, fiberNodes[roleKey], disableInitBoth, (state) => {
        nodeSnapshots[roleKey] = state;
        updateRelayFundAction();
    });
});

createAllBtn.addEventListener("click", async () => {
    createAllBtn.disabled = true;
    await Promise.all(nodeControllers.map((controller) => controller.createAndConnect()));
});

fundRelayBtn.addEventListener("click", async () => {
    relayFundTriggered = true;
    fundRelayBtn.disabled = true;
    try {
        await Promise.all([
            fiberNodes.left.sendRelayFunds(300n),
            fiberNodes.right.sendRelayFunds(300n),
        ]);
    } finally {
        await sleep(500);
        await Promise.all(nodeControllers.map((controller) => controller.refreshChannels()));
    }
});
