import sys
import subprocess
import time

def stream_with_progress(image_name, host, user):
	# Get image size
	try:
		res = subprocess.run(
			["docker", "image", "inspect", image_name, "--format={{.Size}}"],
			capture_output=True, text=True, check=True
		)
		total_bytes = int(res.stdout.strip())
	except Exception:
		total_bytes = 0

	print(f"[*] Tamano estimado: {total_bytes / (1024*1024):.1f} MB")
	print(f"[*] Conectando con {user}@{host}...")

	# Start docker save
	p_save = subprocess.Popen(["docker", "save", image_name], stdout=subprocess.PIPE)
	# Start ssh docker load
	p_load = subprocess.Popen(
		["ssh", f"{user}@{host}", "docker load"],
		stdin=subprocess.PIPE,
		stdout=subprocess.PIPE,
		stderr=subprocess.PIPE
	)

	sent = 0
	start_time = time.time()
	chunk_size = 1024 * 1024 # 1 MB

	try:
		while True:
			chunk = p_save.stdout.read(chunk_size)
			if not chunk:
				break
			p_load.stdin.write(chunk)
			sent += len(chunk)
			elapsed = time.time() - start_time
			speed = (sent / (1024 * 1024)) / elapsed if elapsed > 0 else 0

			if total_bytes > 0:
				pct = min(100.0, (sent / total_bytes) * 100)
				bar_len = 30
				filled = int(bar_len * pct / 100)
				bar = "=" * filled + ">" + " " * (bar_len - filled - 1) if filled < bar_len else "=" * bar_len
				sys.stdout.write(
					f"\rTransferencia: [{bar}] {pct:5.1f}% ({sent/(1024*1024):.1f}/{total_bytes/(1024*1024):.1f} MB) - {speed:.1f} MB/s  "
				)
			else:
				sys.stdout.write(f"\rTransferencia: {sent/(1024*1024):.1f} MB enviados - {speed:.1f} MB/s  ")
			sys.stdout.flush()

		p_load.stdin.close()
		p_save.stdout.close()
		p_save.wait()
		stdout, stderr = p_load.communicate()
		print("\n")
		if p_load.returncode == 0:
			print(stdout.decode(errors="ignore").strip())
			return 0
		else:
			print("Error:", stderr.decode(errors="ignore").strip())
			return p_load.returncode
	except Exception as e:
		print(f"\n[!] Error durante la transferencia: {e}")
		return 1

if __name__ == "__main__":
	if len(sys.argv) < 4:
		print("Uso: python stream_send.py <image_name> <host> <user>")
		sys.exit(1)
	sys.exit(stream_with_progress(sys.argv[1], sys.argv[2], sys.argv[3]))
