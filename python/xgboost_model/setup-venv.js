import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { platform } from "node:os";

try {
    // Check if we're on Windows
    const isWin = platform() === "win32";

    // Use current working directory as the base (which is the "python" folder)
    const baseDir = process.cwd();

    // Set up paths relative to the "python" folder.
    const venvDir = resolve(baseDir, "venv");
    const requirementsPath = join(baseDir, "requirements.txt");
    const trainScript = join(baseDir, "train_model.py");

    // Choose the proper Python command for creating the venv.
    // On Unix-like systems, use "python3"; on Windows, "python".
    const basePython = isWin ? "python" : "python3";

    // Create the virtual environment.
    console.log("Creating virtual environment...");
    execSync(`${basePython} -m venv ${venvDir}`, { stdio: "inherit" });

    // Determine the correct Python executable in the virtual environment.
    const venvPython = isWin ? join(venvDir, "Scripts", "python.exe") : join(venvDir, "bin", "python");

    // Upgrade pip.
    console.log("Upgrading pip...");
    execSync(`${venvPython} -m pip install --upgrade pip`, {
        stdio: "inherit",
    });

    // Install dependencies.
    console.log("Installing dependencies...");
    execSync(`${venvPython} -m pip install -r "${requirementsPath}"`, {
        stdio: "inherit",
    });

    // Run the training script.
    console.log("Running training script...");
    execSync(`${venvPython} "${trainScript}"`, {
        stdio: "inherit",
    });

    console.log("Setup complete!");
} catch (error) {
    console.error("Error during setup:", error);
    process.exit(1);
}
