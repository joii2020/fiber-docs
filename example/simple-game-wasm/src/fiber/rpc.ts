import { Hex, RequestorJsonRpc } from "@ckb-ccc/core";

// Define types based on Fiber RPC documentation https://github.com/nervosnetwork/fiber/blob/main/src/rpc/README.md
type Hash256 = string;
type Pubkey = string;
type PeerId = string;
type MultiAddr = string;
type Script = {
    code_hash: string;
    hash_type: string;
    args: string;
};
type Currency = "Fibb" | "Fibt" | "Fibd";
type HashAlgorithm = "CkbHash" | "Sha256";
type CkbInvoiceStatus = "Open" | "Cancelled" | "Expired" | "Received" | "Paid";
type PaymentSessionStatus = "Created" | "Inflight" | "Success" | "Failed";
type HopHint = {
    pubkey: Pubkey;
    channel_funding_tx: Hash256;
    inbound: boolean;
};
type SessionRoute = {
    nodes: any[]; // Using any[] for simplicity
};

export class FiberRPC {
    rpc: RequestorJsonRpc;
    constructor(public readonly rpcUrl: string) {
        this.rpc = new RequestorJsonRpc(rpcUrl);
    }

    // Channel Module
    /**
     * Attempts to open a channel with a peer.
     */
    async openChannel(params: {
        peer_id: PeerId;
        funding_amount: string;
        public?: boolean;
        funding_udt_type_script?: Script;
        shutdown_script?: Script;
        commitment_delay_epoch?: string;
        commitment_fee_rate?: string;
        funding_fee_rate?: string;
        tlc_expiry_delta?: string;
        tlc_min_value?: string;
        tlc_fee_proportional_millionths?: string;
        max_tlc_value_in_flight?: string;
        max_tlc_number_in_flight?: string;
    }): Promise<{ temporary_channel_id: Hash256 }> {
        return this.rpc.request("open_channel", [params]) as Promise<{
            temporary_channel_id: Hash256;
        }>;
    }

    /**
     * Accepts a channel opening request from a peer.
     */
    async acceptChannel(params: {
        temporary_channel_id: Hash256;
        funding_amount: string;
        shutdown_script?: Script;
        max_tlc_value_in_flight?: string;
        max_tlc_number_in_flight?: string;
        tlc_min_value?: string;
        tlc_fee_proportional_millionths?: string;
        tlc_expiry_delta?: string;
    }): Promise<{ channel_id: Hash256 }> {
        return this.rpc.request("accept_channel", [params]) as Promise<{
            channel_id: Hash256;
        }>;
    }

    /**
     * Lists all channels.
     */
    async listChannels(params?: {
        peer_id?: PeerId;
        include_closed?: boolean;
    }): Promise<{ channels: any[] }> {
        return this.rpc.request(
            "list_channels",
            params ? [params] : [],
        ) as Promise<{ channels: any[] }>;
    }

    /**
     * Shuts down a channel.
     */
    async shutdownChannel(params: {
        channel_id: Hash256;
        close_script: Script;
        force?: boolean;
        fee_rate: string;
    }): Promise<void> {
        return this.rpc.request("shutdown_channel", [params]) as Promise<void>;
    }

    /**
     * Updates a channel.
     */
    async updateChannel(params: {
        channel_id: Hash256;
        enabled?: boolean;
        tlc_expiry_delta?: string;
        tlc_minimum_value?: string;
        tlc_fee_proportional_millionths?: string;
    }): Promise<void> {
        return this.rpc.request("update_channel", [params]) as Promise<void>;
    }

    // Invoice Module
    /**
     * Generates a new invoice.
     */
    async newInvoice(params: {
        amount: string;
        description?: string;
        currency: Currency;
        payment_preimage?: Hash256;
        payment_hash?: Hash256;
        expiry?: string;
        fallback_address?: string;
        final_expiry_delta?: string;
        udt_type_script?: Script;
        hash_algorithm?: HashAlgorithm;
        allow_mpp?: boolean;
    }): Promise<{
        invoice_address: string;
        invoice: any;
    }> {
        return this.rpc.request("new_invoice", [params]) as Promise<{
            invoice_address: string;
            invoice: any;
        }>;
    }

    /**
     * Parses a encoded invoice.
     */
    async parseInvoice(invoice: string): Promise<{ invoice: any }> {
        return this.rpc.request("parse_invoice", [{ invoice }]) as Promise<{
            invoice: any;
        }>;
    }

    /**
     * Retrieves an invoice.
     */
    async getInvoice(payment_hash: Hash256): Promise<{
        invoice_address: string;
        invoice: any;
        status: CkbInvoiceStatus;
    }> {
        return this.rpc.request("get_invoice", [{ payment_hash }]) as Promise<{
            invoice_address: string;
            invoice: any;
            status: CkbInvoiceStatus;
        }>;
    }

    /**
     * Cancels an invoice, only when invoice is in status `Open` can be canceled.
     */
    async cancelInvoice(payment_hash: Hash256): Promise<{
        invoice_address: string;
        invoice: any;
        status: CkbInvoiceStatus;
    }> {
        return this.rpc.request("cancel_invoice", [
            { payment_hash },
        ]) as Promise<{
            invoice_address: string;
            invoice: any;
            status: CkbInvoiceStatus;
        }>;
    }

    // Peer Module
    /**
     * Connect to a peer.
     */
    async connectPeer(params: {
        address: MultiAddr;
        save?: boolean;
    }): Promise<void> {
        return this.rpc.request("connect_peer", [params]) as Promise<void>;
    }

    /**
     * Disconnect from a peer.
     */
    async disconnectPeer(peer_id: PeerId): Promise<void> {
        return this.rpc.request("disconnect_peer", [
            { peer_id },
        ]) as Promise<void>;
    }

    // Payment Module
    /**
     * Sends a payment to a peer.
     */
    async sendPayment(params: {
        target_pubkey?: Pubkey;
        amount?: string;
        payment_hash?: Hash256;
        final_tlc_expiry_delta?: string;
        tlc_expiry_limit?: string;
        invoice?: string;
        timeout?: string;
        max_fee_amount?: string;
        max_parts?: string;
        keysend?: boolean;
        udt_type_script?: Script;
        allow_self_payment?: boolean;
        custom_records?: any;
        hop_hints?: HopHint[];
        dry_run?: boolean;
    }): Promise<{
        payment_hash: Hash256;
        status: PaymentSessionStatus;
        created_at: string;
        last_updated_at: string;
        failed_error?: string;
        fee: string;
        custom_records?: any;
        routers: SessionRoute[];
    }> {
        return this.rpc.request("send_payment", [params]) as Promise<{
            payment_hash: Hash256;
            status: PaymentSessionStatus;
            created_at: string;
            last_updated_at: string;
            failed_error?: string;
            fee: string;
            custom_records?: any;
            routers: SessionRoute[];
        }>;
    }

    /**
     * Retrieves a payment.
     */
    async getPayment(payment_hash: Hash256): Promise<{
        payment_hash: Hash256;
        status: PaymentSessionStatus;
        created_at: string;
        last_updated_at: string;
        failed_error?: string;
        fee: string;
        custom_records?: any;
        routers: SessionRoute[];
    }> {
        return this.rpc.request("get_payment", [{ payment_hash }]) as Promise<{
            payment_hash: Hash256;
            status: PaymentSessionStatus;
            created_at: string;
            last_updated_at: string;
            failed_error?: string;
            fee: string;
            custom_records?: any;
            routers: SessionRoute[];
        }>;
    }

    async nodeInfo() {
        return this.rpc.request("node_info", []) as Promise<{
            version: string;
            commit_hash: string;
            node_id: string;
            features: string[];
            node_name?: string;
            addresses: string[];
            chain_hash: Hex;
            open_channel_auto_accept_min_ckb_funding_amount: string;
            auto_accept_channel_ckb_funding_amount: string;
            default_funding_lock_script: Script;
            tlc_expiry_delta: string;
            tlc_min_value: string;
            tlc_fee_proportional_millionths: string;
            channel_count: number;
            pending_channel_count: number;
            peers_count: number;
            udt_cfg_infos: any;
        }>;
    }
}
