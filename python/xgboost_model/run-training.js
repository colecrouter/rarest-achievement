import { execSync } from "node:child_process";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

try {
	const baseDir = dirname(fileURLToPath(import.meta.url));
	const venvPython =
		platform() === "win32"
			? join(baseDir, "venv", "Scripts", "python.exe")
			: join(baseDir, "venv", "bin", "python");
	const trainScript = join(baseDir, "train_model.py");

	console.log("Running training script...");
	execSync(`${venvPython} "${trainScript}"`, { stdio: "inherit", cwd: baseDir });

	console.log("Training complete!");
} catch (error) {
	console.error("Error running training script:", error);
	process.exit(1);
}
