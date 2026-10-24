import asyncio
import json
import websockets

async def main():
	uri = "ws://localhost:8080/ws/chat?turn_id=diag_test_tts_resilience"
	print(f"Connecting with tts_mode='rpi5' (piper down test)...")
	async with websockets.connect(uri) as ws:
		payload = {
			"turn_id": "diag_test_tts_resilience",
			"session_id": "main",
			"messages": [
				{"role": "user", "content": "Hola, ¿me recibes?"}
			],
			"tts_mode": "rpi5"
		}
		await ws.send(json.dumps(payload))
		received_tokens = []
		while True:
			try:
				msg = await asyncio.wait_for(ws.recv(), timeout=20)
				data = json.loads(msg)
				mtype = data.get("type")
				if mtype == "status":
					print("Status:", data.get("status"))
				elif mtype == "token":
					tok = data.get("token")
					received_tokens.append(tok)
					print(tok, end="", flush=True)
				elif mtype == "error":
					print("\n[ERROR RECEIVED]:", data.get("message"))
					break
				elif mtype == "done":
					print("\n[DONE] Full text:", data.get("full_text"))
					break
			except asyncio.TimeoutError:
				print("\nTimeout waiting for response.")
				break

	print("\nTokens received count:", len(received_tokens))
	assert len(received_tokens) > 0, "No tokens received!"

if __name__ == "__main__":
	asyncio.run(main())
