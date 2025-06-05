import { execSync } from "node:child_process";
import { platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packages = ["wasm-pack", "wasm-bindgen-cli"];

try {
    const baseDir = dirname(fileURLToPath(import.meta.url));
    try {
        execSync("cargo --version", { stdio: "ignore" });
    } catch (err) {
        console.error("Cargo is not installed. Please install Rust and Cargo first.");
        process.exit(1);
    }

    for (const pkg of packages) {
        console.log(`Installing ${pkg}...`);
        execSync(`cargo install ${pkg}`, { stdio: "inherit" });
    }

    console.log("Rust setup complete!");
} catch (error) {
    console.error("Error during setup:", error);
    process.exit(1);
}
