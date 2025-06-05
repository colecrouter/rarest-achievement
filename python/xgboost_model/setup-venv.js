import { execSync } from "node:child_process";
import { platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

try {
    const baseDir = dirname(fileURLToPath(import.meta.url));
    const venvDir = resolve(baseDir, "venv");
    const requirementsPath = join(baseDir, "requirements.txt");
    const basePython = platform() === "win32" ? "python" : "python3";

    // Bootstrap pip if missing using --break-system-packages
    try {
        execSync(`${basePython} -m pip --version`, { stdio: "ignore" });
    } catch (err) {
        console.log("pip not available. Bootstrapping pip using get-pip.py...");
        execSync("curl -sS https://bootstrap.pypa.io/get-pip.py -o get-pip.py", { stdio: "inherit" });
        execSync(`${basePython} get-pip.py --break-system-packages`, { stdio: "inherit" });
        execSync("rm get-pip.py", { stdio: "inherit" });
    }

    // Ensure virtualenv is installed, but if not, we can fallback to venv
    let created = false;
    console.log("Attempting to create virtual environment using virtualenv...");
    try {
        execSync(`${basePython} -m pip install --break-system-packages virtualenv`, { stdio: "inherit" });
        // Try creating the venv using virtualenv
        execSync(`${basePython} -m virtualenv ${venvDir}`, { stdio: "inherit" });
        created = true;
    } catch (err) {
        console.log("virtualenv module not found. Falling back to built-in venv...");
    }

    if (!created) {
        // Fallback: use built-in venv
        // (Note: ensure that ensurepip is available in this environment)
        execSync(`${basePython} -m venv ${venvDir}`, { stdio: "inherit" });
    }

    console.log("Upgrading pip...");
    execSync(`${venvDir}/bin/python -m pip install --upgrade pip`, { stdio: "inherit" });

    console.log("Installing dependencies...");
    execSync(`${venvDir}/bin/python -m pip install -r "${requirementsPath}"`, { stdio: "inherit" });

    console.log("Python setup complete!");
} catch (error) {
    console.error("Error during setup:", error);
    process.exit(1);
}
