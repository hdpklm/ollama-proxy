import os
import sys
import time
import urllib.request
import paramiko

HOST = "192.168.1.200"
USER = "inibir"
PASS = "314237"
REMOTE_DIR = "/docker/repos/ollama-proxy"

def main():
	sys.stdout.reconfigure(encoding="utf-8")
	print(f"Connecting to {HOST} as {USER}...")
	ssh = paramiko.SSHClient()
	ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
	ssh.connect(HOST, username=USER, password=PASS, timeout=10)
	print("Connected successfully!")

	sftp = ssh.open_sftp()
	files_to_sync = [
		("Dockerfile", f"{REMOTE_DIR}/Dockerfile"),
		("docker-compose.yml", f"{REMOTE_DIR}/docker-compose.yml"),
		("pyproject.toml", f"{REMOTE_DIR}/pyproject.toml"),
		("uv.lock", f"{REMOTE_DIR}/uv.lock"),
		(os.path.join("backend", "config.py"), f"{REMOTE_DIR}/backend/config.py"),
	]

	for local, remote in files_to_sync:
		if os.path.exists(local):
			print(f"Syncing {local} -> {remote}...")
			sftp.put(local, remote)

	sftp.close()

	print("Stopping old container and rebuilding with docker compose...")
	cmd = f"cd {REMOTE_DIR} && docker compose down && docker compose up -d --build"
	stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)

	for line in iter(stdout.readline, ""):
		print(line, end="")

	exit_code = stdout.channel.recv_exit_status()
	print(f"\nDocker compose command finished with exit code {exit_code}")

	print("Monitoring logs until server is ready...")
	start_time = time.time()
	ready = False
	while time.time() - start_time < 90:
		try:
			req = urllib.request.Request(
				f"http://{HOST}:8000/v1/models",
				headers={"Authorization": "Bearer cambia_esta_clave"}
			)
			with urllib.request.urlopen(req, timeout=2) as resp:
				if resp.status == 200:
					print("Proxy server is READY and accepting connections on port 8000!")
					ready = True
					break
		except Exception:
			time.sleep(2)

	if not ready:
		print("Server not ready yet. Fetching container logs:")
		_, stdout, _ = ssh.exec_command(f"cd {REMOTE_DIR} && docker compose logs --tail 30")
		print(stdout.read().decode("utf-8", errors="replace"))

	ssh.close()

if __name__ == "__main__":
	main()
