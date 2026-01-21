# Fiber WASM Relay Demo

This example spins up two Fiber WASM nodes in the browser, then connects each node to the same relay peer.

## Getting Started

```bash
pnpm install
pnpm run dev
```

## Notes

- Enter a 32-byte CKB secret key in hex (0x + 64 hex chars) for each node.
- The demo loads `public/fiber-config-testnet.yml` at startup.
