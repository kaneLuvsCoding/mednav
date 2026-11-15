"""Run the unmodified package in disposable copies; never target a shared API."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

from app.member4_import import import_package

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "vendor/member4"


def run(mode):
    results = ROOT / "qa_results"
    results.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="mednav-member4-") as temp:
        temp = Path(temp)
        copy = temp / "package"
        shutil.copytree(PACKAGE, copy)
        env = dict(os.environ)
        for key in list(env):
            if key.startswith("MEDNAV_"):
                env.pop(key)
        env["PYTHONPATH"] = os.pathsep.join([str(ROOT), str(copy / "tests/member4")])
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        server = None
        try:
            command = [sys.executable, str(copy / "tests/member4/run_evaluation.py")]
            if mode == "integrated":
                database = temp / "isolated-qa.db"
                imported = import_package(copy, database)
                (results / "import_result.json").write_text(json.dumps(imported, indent=2) + "\n", encoding="utf-8")
                with socket.socket() as sock:
                    sock.bind(("127.0.0.1", 0))
                    port = sock.getsockname()[1]
                env["MEDNAV_MEMBER4_TEST_DB"] = str(database)
                env["MEDNAV_API_URL"] = f"http://127.0.0.1:{port}"
                env["MEDNAV_INVENTORY_API_EVALUATOR"] = "integration.member4_adapter:evaluate"
                # No real engine is installed in this run. Do not configure a demo evaluator.
                log = (results / "isolated_server.log").open("w", encoding="utf-8")
                server = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.member4_app:factory", "--factory", "--host", "127.0.0.1", "--port", str(port)], cwd=ROOT, env=env, stdout=log, stderr=log)
                for _ in range(100):
                    if server.poll() is not None:
                        raise RuntimeError("Isolated QA server exited; inspect isolated_server.log")
                    try:
                        with urlopen(env["MEDNAV_API_URL"] + "/api/v1/healthz", timeout=1):
                            break
                    except OSError:
                        time.sleep(0.1)
                else:
                    raise RuntimeError("Isolated server failed to start")
                # Test itself is unchanged in the snapshot. Mark ONLY the engine-dependent
                # HTTP scenarios pending in memory; invalid-type HTTP validation still runs.
                script = "import runpy,unittest,test_member4; test_member4.ApiTests.test_valid_scenarios=unittest.skip('Real Member3 engine absent; HTTP engine scenarios pending')(test_member4.ApiTests.test_valid_scenarios); runpy.run_path(" + repr(str(copy / "tests/member4/run_evaluation.py")) + ",run_name='__main__')"
                command = [sys.executable, "-c", script]
            completed = subprocess.run(command, cwd=copy, env=env, capture_output=True, text=True, timeout=120)
            (results / f"member4_{mode}.log").write_text(completed.stdout + completed.stderr, encoding="utf-8")
            report = json.loads((copy / "docs/evaluation_results.json").read_text())
            report["integration_mode"] = mode
            report["engine_configured"] = False
            report["database_isolation"] = "TemporaryDirectory; server terminated and database deleted after run"
            (results / f"member4_{mode}.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
            print(json.dumps({k: report[k] for k in ("total", "passed", "failed_or_error", "skipped")}, indent=2))
            return completed.returncode
        finally:
            if server is not None:
                server.terminate()
                try:
                    server.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait(timeout=10)
                log.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["baseline", "integrated"])
    raise SystemExit(run(parser.parse_args().mode))
