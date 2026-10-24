import asyncio
import json
import time
import websockets

async def test_chat():
	turn_id = f"test_{int(time.time()*1000)}"
	session_id = "test_session_diag"
	chat_url = f"ws://localhost:8080/ws/chat?turn_id={turn_id}"
	metrics_url = f"ws://localhost:8080/ws/chat/metrics?turn_id={turn_id}"

	print(f"Connecting to metrics: {metrics_url}")
	print(f"Connecting to chat: {chat_url}")

	async def listen_metrics():
		try:
			async with websockets.connect(metrics_url) as ws_m:
				async for msg in ws_m:
					d = json.loads(msg)
					print(f"[METRIC {time.time():.3f}] {d}")
					if d.get("type") == "metrics_done":
						break
		except Exception as e:
			print(f"[METRICS ERR] {e}")

	async def run_chat():
		await asyncio.sleep(0.1) # wait for metrics WS to connect
		async with websockets.connect(chat_url) as ws_c:
			t0 = time.time()
			payload = {
				"turn_id": turn_id,
				"session_id": session_id,
				"messages": [
					{"role": "user", "content": "Hola, ¿cómo estás? Responde en una sola frase."}
				],
				"tts_mode": "none"
			}
			await ws_c.send(json.dumps(payload))
			first_token_time = None
			full_text = ""
			async for msg in ws_c:
				d = json.loads(msg)
				mtype = d.get("type")
				now = time.time()
				if mtype == "status":
					print(f"[{now - t0:.2f}s STATUS] {d.get('status')}")
				elif mtype == "token":
					if first_token_time is None:
						first_token_time = now - t0
						print(f"[{first_token_time:.2f}s FIRST TOKEN] '{d.get('token')}'")
					full_text += d.get("token", "")
				elif mtype == "thinking_token":
					print(f"[{now - t0:.2f}s THINKING] {d.get('token')}")
				elif mtype == "done":
					print(f"[{now - t0:.2f}s DONE] Full text: {full_text}")
					break
				elif mtype == "error":
					print(f"[{now - t0:.2f}s ERROR] {d}")
					break
				else:
					print(f"[{now - t0:.2f}s MSG] {mtype}: {d}")

	await asyncio.gather(listen_metrics(), run_chat())

if __name__ == "__main__":
	asyncio.run(test_chat())
