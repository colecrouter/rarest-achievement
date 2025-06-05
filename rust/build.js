import { execSync } from "node:child_process";
import { readdirSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get all child folders in the current directory
const currentDir = dirname(fileURLToPath(import.meta.url));

// Remove existing directory if it exists
if (existsSync("../../packages/lib/src/ml/wasm")) {
    execSync(`rm -rf ${join(currentDir, "../../packages/lib/src/ml/wasm")}`);
}
mkdirSync("../../packages/lib/src/ml/wasm", { recursive: true });

const outBaseDir = "../../packages/lib/src/ml/wasm";

const childFolders = readdirSync(currentDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

for (const folder of childFolders) {
    const folderPath = join(currentDir, folder);

    try {
        console.log(`Building "${folder}" package...`);

        // tell wasm-pack where to place the pkg folder
        execSync(
            `cargo build --lib --target wasm32-unknown-unknown && wasm-bindgen ./target/wasm32-unknown-unknown/debug/*.wasm --target experimental-nodejs-module --out-dir ${outBaseDir}`,
            {
                cwd: folderPath,
                stdio: "inherit",
            },
        );
        console.log(`Building "${folder}" package complete!`);
    } catch (error) {
        console.error(`Error during build of "${folder}":`, error);
        process.exit(1);
    }
}
