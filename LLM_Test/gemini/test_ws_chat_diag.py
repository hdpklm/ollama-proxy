import asyncio
import json
import websockets

async def main():
	uri = "ws://localhost:8080/ws/chat?turn_id=diag_test_2"
	print(f"Connecting for Turn 2...")
	async with websockets.connect(uri) as ws:
		payload = {
			"turn_id": "diag_test_2",
			"session_id": "main",
			"messages": [
				{"role": "user", "content": "hola"},
				{"role": "assistant", "content": "Hola. ¿En qué puedo ayudarte hoy?"},
				{"role": "user", "content": "¿Qué hora tienes?"}
			],
			"tts_mode": "none"
		}
		await ws.send(json.dumps(payload))
		while True:
			try:
				msg = await asyncio.wait_for(ws.recv(), timeout=30)
				data = json.loads(msg)
				mtype = data.get("type")
				if mtype == "status":
					print("Status:", data.get("status"))
				elif mtype == "token":
					print("Token:", repr(data.get("token")), end=" ", flush=True)
				elif mtype == "done":
					print("\nDone! Full text:", data.get("full_text"))
					print("Total turn seconds:", data.get("total_turn_seconds"))
					break
			except asyncio.TimeoutError:
				print("\nTimeout waiting for response in Turn 2.")
				break

if __name__ == "__main__":
	asyncio.run(main())
