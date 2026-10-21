import asyncio
import json
import time
import websockets

async def main():
	uri = "ws://127.0.0.1:8080/ws/chat"
	print(f"Conectando a {uri}...")

	async with websockets.connect(uri) as ws:
		print("WebSocket conectado.")
		payload = {
			"type": "chat",
			"messages": [
				{"role": "user", "content": "qué tiempo hace mañana en Barcelona"}
			],
			"fast": True,
			"priority": False
		}
		print("Enviando mensaje:", payload)
		await ws.send(json.dumps(payload))

		t0 = time.time()
		event_count = 0
		tokens_text = ""

		while True:
			try:
				raw = await asyncio.wait_for(ws.recv(), timeout=300)
				event_count += 1
				data = json.loads(raw)
				msg_type = data.get("type", "unknown")

				if msg_type == "debug":
					print(f"\n[DEBUG EVENT] stage={data.get('stage')} step={data.get('step')} {data}")
				elif msg_type == "thinking_token":
					print(f"[THINKING TOKEN] {data.get('token')}", end="", flush=True)
				elif msg_type == "thinking_done":
					print("\n[THINKING DONE]")
				elif msg_type == "tool_calling_token":
					print(f"[TOOL TOKEN] {data.get('token')}", end="", flush=True)
				elif msg_type == "tool_calling":
					print(f"\n[TOOL CALLING] Herramienta={data.get('tool')} Args={data.get('args')}")
				elif msg_type == "tool_executing":
					print(f"[TOOL EXECUTING] Ejecutando {data.get('tool')}...")
				elif msg_type == "tool_result":
					preview = str(data.get("result", ""))[:120].replace("\n", " ")
					print(f"[TOOL RESULT] {data.get('tool')}: {preview}...")
				elif msg_type == "token":
					token = data.get("token", "")
					tokens_text += token
					print(token, end="", flush=True)
				elif msg_type == "done":
					print(f"\n\n[EVENTO DONE] full_text={len(data.get('full_text', ''))} chars, tools_used={data.get('tools_used')}")
					print("Usage / Métricas:", json.dumps(data.get("usage", {}), indent=2))
					break
				elif msg_type == "error":
					print(f"\n[ERROR] {data.get('message')}")
					break
				else:
					print(f"\n[EVENT {msg_type}]", data)
			except asyncio.TimeoutError:
				print("\nTimeout esperando eventos.")
				break

		print(f"\nTotal eventos recibidos: {event_count} en {time.time() - t0:.2f}s")

if __name__ == "__main__":
	asyncio.run(main())
