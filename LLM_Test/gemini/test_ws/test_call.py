import sys
import os

sys.path.insert(0, os.path.abspath("interface/backend"))
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("Starting websocket test...")
try:
	with client.websocket_connect("/ws/call") as ws:
		print("Connected successfully!")
		ws.send_text('{"type": "config", "tts_mode": "rpi5"}')
		print("Sent config text successfully!")
		ws.send_bytes(b"\x00" * 3200)
		print("Sent binary audio bytes successfully!")
except Exception as e:
	import traceback
	traceback.print_exc()

print("Finished test.")
