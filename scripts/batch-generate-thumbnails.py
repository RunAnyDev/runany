"""Legacy wrapper for batch thumbnail generation via local SVG -> WebP flow."""
import subprocess
from pathlib import Path

root = Path("/Users/friday/personal/runany")
cmd = ["node", str(root / "scripts/batch-missing-thumbnails.mjs")]
print("Running:", " ".join(cmd))
subprocess.run(cmd, cwd=root, check=True)
