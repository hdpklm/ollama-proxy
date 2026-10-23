import os
import sys
import asyncio
import unittest

current_dir = os.path.dirname(os.path.abspath(__file__))
interface_backend = os.path.abspath(os.path.join(current_dir, "..", "..", "..", "interface", "backend"))
if interface_backend not in sys.path:
	sys.path.insert(0, interface_backend)

from services.tree_context_manager import TreeNode, TreeContextManager
from services.silence_killer import format_silence_killer_status, format_step_completion_status
from services.plan_and_solve import is_complex_request

class TestPhase9Features(unittest.IsolatedAsyncioTestCase):
	async def test_tree_node_and_hierarchical_projection(self):
		mgr = TreeContextManager(redis_url="") # Memory fallback
		branch_id = "test_branch_1"

		# 1. Add 3-level topics to RAG
		await mgr.archive_to_tree(branch_id, "cumpleaños", "restaurante", "casa carmen", data="reserva 15p")
		await mgr.archive_to_tree(branch_id, "cumpleaños", "restaurante", "kfc", data="rapido")
		await mgr.archive_to_tree(branch_id, "cumpleaños", "invitacion", "luis")
		await mgr.archive_to_tree(branch_id, "cumpleaños", "invitacion", "jabi")
		await mgr.archive_to_tree(branch_id, "cumpleaños", "invitacion", "jordi")

		await mgr.archive_to_tree(branch_id, "fisica cuantica", "patron de interferencia", "como funciona")
		await mgr.archive_to_tree(branch_id, "fisica cuantica", "borrador cuantico", "como funciona")

		# 2. Query focused on 'cumpleaños'
		ctx_cumple = await mgr.project_context(branch_id, "mira restaurantes para el cumpleaños")
		self.assertIn("[datos en RAG]:", ctx_cumple)
		# Active topic should have 3 levels expanded
		self.assertIn("- cumpleaños:", ctx_cumple)
		self.assertIn("  - restaurante:", ctx_cumple)
		self.assertIn("    -- casa carmen", ctx_cumple)
		self.assertIn("    -- kfc", ctx_cumple)
		# Inactive topic should be collapsed to 1 line
		self.assertIn("- fisica cuantica: patron de interferencia, borrador cuantico", ctx_cumple)

		# 3. Query focused on 'cuantica' -> focus should switch smoothly
		ctx_cuantica = await mgr.project_context(branch_id, "¿cómo funcionaba el borrador cuantico?")
		# Active topic now expanded
		self.assertIn("- fisica cuantica:", ctx_cuantica)
		self.assertIn("  - borrador cuantico:", ctx_cuantica)
		self.assertIn("    -- como funciona", ctx_cuantica)
		# Inactive topic now collapsed to 1 line
		self.assertIn("- cumpleaños: restaurante, invitacion", ctx_cuantica)

	async def test_sliding_window_and_denoising(self):
		mgr = TreeContextManager(redis_url="")
		branch_id = "sliding_test"

		# Add 4 normal turns
		for i in range(4):
			await mgr.add_turn(branch_id, f"Pregunta {i}", f"Respuesta {i}")

		# 5th turn contains a noise calculation "5x7"
		await mgr.add_turn(branch_id, "5x7", "35")

		branch = await mgr.get_or_create_branch(branch_id)
		# Denoising runs on turn 5: "5x7" and "35" should be purged
		user_contents = [m["content"] for m in branch["messages"] if m["role"] == "user"]
		self.assertNotIn("5x7", user_contents)

		# Add 10 more turns to test strict 10-message limit
		for i in range(10, 20):
			await mgr.add_turn(branch_id, f"Pregunta {i}", f"Respuesta {i}")

		branch = await mgr.get_or_create_branch(branch_id)
		# Total messages must never exceed 10 (5 user + 5 assistant)
		self.assertLessEqual(len(branch["messages"]), 10)

	async def test_fork_branch(self):
		mgr = TreeContextManager(redis_url="")
		await mgr.archive_to_tree("orig", "viaje", "destino", "roma")
		await mgr.add_turn("orig", "vamos a roma", "excelente opcion")

		forked = await mgr.fork_branch("orig", "forked_1", "Rama Roma Alternativa")
		self.assertEqual(forked["id"], "forked_1")
		self.assertEqual(forked["name"], "Rama Roma Alternativa")
		self.assertIn("viaje", forked["tree"].children)

	def test_silence_killer_formatting(self):
		# Web search query extraction
		status = format_silence_killer_status("search_web", {"query": "tiempo fin de semana en barcelona"})
		self.assertTrue(status.startswith("Buscando en la web:"))
		self.assertIn("tiempo", status)
		self.assertLessEqual(len(status.split()), 10)

		# Sub-agent task extraction
		status_res = format_silence_killer_status("delegate_to_researcher", {"task": "analizar benchmarks de llama.cpp en ARM64"})
		self.assertTrue(status_res.startswith("Investigador analizando:"))
		self.assertLessEqual(len(status_res.split()), 10)

		# Step completion status
		step_st = format_step_completion_status(2, 4, "previsión del tiempo")
		self.assertIn("Paso 2/4 listo:", step_st)
		self.assertLessEqual(len(step_st.split()), 10)

	def test_complex_request_detection(self):
		# Simple / direct queries
		self.assertFalse(is_complex_request("hola que tal"))
		self.assertFalse(is_complex_request("cuanto es 5x7"))
		self.assertFalse(is_complex_request("que hora es en madrid"))

		# Complex multi-step queries
		self.assertTrue(is_complex_request("planifica mi cumpleaños y mira el tiempo en barcelona para este fin de semana"))
		self.assertTrue(is_complex_request("busca restaurantes en el centro y ademas averigua si tienen terraza"))
		self.assertTrue(is_complex_request("organiza un itinerario de 3 dias para visitar roma"))

if __name__ == "__main__":
	unittest.main()
