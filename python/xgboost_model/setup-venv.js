import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { platform } from "node:os";

try {
    const isWin = platform() === "win32";
    const baseDir = process.cwd();
    const venvDir = resolve(baseDir, "venv");
    const requirementsPath = join(baseDir, "requirements.txt");
    const trainScript = join(baseDir, "train_model.py");
    const basePython = isWin ? "python" : "python3";

    // Bootstrap pip if missing using --break-system-packages
    try {
        execSync(`${basePython} -m pip --version`, { stdio: "ignore" });
    } catch (err) {
        console.log("pip not available. Bootstrapping pip using get-pip.py...");
        execSync(`curl -sS https://bootstrap.pypa.io/get-pip.py -o get-pip.py`, { stdio: "inherit" });
        execSync(`${basePython} get-pip.py --break-system-packages`, { stdio: "inherit" });
        execSync(`rm get-pip.py`, { stdio: "inherit" });
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

    const venvPython = isWin
        ? join(venvDir, "Scripts", "python.exe")
        : join(venvDir, "bin", "python");

    console.log("Upgrading pip...");
    execSync(`${venvPython} -m pip install --upgrade pip`, { stdio: "inherit" });
    
    console.log("Installing dependencies...");
    execSync(`${venvPython} -m pip install -r "${requirementsPath}"`, { stdio: "inherit" });
    
    console.log("Running training script...");
    execSync(`${venvPython} "${trainScript}"`, { stdio: "inherit" });
    
    console.log("Setup complete!");
} catch (error) {
    console.error("Error during setup:", error);
    process.exit(1);
}