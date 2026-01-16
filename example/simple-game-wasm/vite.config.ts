import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    base: "./",
    plugins: [tailwindcss()],
    server: {
        proxy: {
            "/node1-api": {
                target: "http://localhost:8227",
                changeOrigin: true,
            },
            "/node2-api": {
                target: "http://localhost:8237",
                changeOrigin: true,
            },
        },
    },
});
