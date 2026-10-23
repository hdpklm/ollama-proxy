import os
import sys
import shutil
import tempfile
import unittest

current_dir = os.path.dirname(os.path.abspath(__file__))
interface_backend = os.path.abspath(os.path.join(current_dir, "..", "..", "..", "interface", "backend"))
if interface_backend not in sys.path:
	sys.path.insert(0, interface_backend)

from services.conversation_logger import ConversationLogger

class TestConversationLogger(unittest.TestCase):
	def setUp(self):
		self.temp_dir = tempfile.mkdtemp(prefix="test_conv_logs_")
		self.logger = ConversationLogger(base_dir=self.temp_dir)

	def tearDown(self):
		shutil.rmtree(self.temp_dir, ignore_errors=True)

	def test_session_dir_creation(self):
		folder = self.logger.get_or_create_session_dir("sess_123", title="Cumpleaños en Barcelona")
		self.assertTrue(os.path.isdir(folder))
		folder_name = os.path.basename(folder)
		self.assertIn("cumpleaños-en-barcelona", folder_name.lower())

	def test_log_user_turn_with_full_memory(self):
		last_10 = [
			{"role": "user", "content": f"pregunta {i}"} if i % 2 == 1 else {"role": "assistant", "content": f"respuesta {i}"}
			for i in range(1, 11)
		]
		tree_rag = (
			"- cumpleaños:\n"
			"  - restaurante:\n"
			"    -- casa carmen\n"
			"    -- kfc\n"
			"- fisica cuantica: patron de interferencia"
		)
		sys_prompt = "Eres un asistente conversacional conciso."
		user_msg = "busca cual son los mejores platos en casa carmen"
		final_resp = "Los platos recomendados son el arroz negro y el solomillo."

		filepath = self.logger.log_user_turn(
			session_id="cumple_session",
			title=user_msg,
			system_prompt=sys_prompt,
			tree_rag_context=tree_rag,
			last_10_messages=last_10,
			user_message=user_msg,
			final_response=final_resp,
			metadata={"model": "gemma4:e2b"}
		)

		self.assertTrue(os.path.isfile(filepath))
		self.assertTrue(filepath.endswith("001-user.md"))

		with open(filepath, "r", encoding="utf-8") as f:
			content = f.read()

		# Check YAML frontmatter category
		self.assertIn("category: user_turn", content)
		self.assertIn("index: 1", content)

		# Check sections
		self.assertIn("System Prompt Efectivo", content)
		self.assertIn("Eres un asistente conversacional conciso.", content)
		self.assertIn("Memoria RAG Jerárquica en Árbol (TreeNode)", content)
		self.assertIn("casa carmen", content)
		self.assertIn("Historial Activo Reciente (Últimos 10 Mensajes)", content)
		self.assertIn("- **[USER] (#1):** pregunta 1", content)
		self.assertIn("Mensaje Actual del Usuario", content)
		self.assertIn(user_msg, content)
		self.assertIn("Respuesta Final Generada por el LLM", content)
		self.assertIn(final_resp, content)

	def test_log_tool_call(self):
		filepath = self.logger.log_tool_call(
			session_id="cumple_session",
			tool_name="search_web",
			args={"query": "mejores platos casa carmen barcelona"},
			result="Platos populares: paella, bravas, arroz negro.",
			metadata={"duration_seconds": 1.25}
		)
		self.assertTrue(filepath.endswith("001-tool-search_web.md"))

		with open(filepath, "r", encoding="utf-8") as f:
			content = f.read()

		self.assertIn("category: tool_call", content)
		self.assertIn("tool_name: \"search_web\"", content)
		self.assertIn("mejores platos casa carmen", content)
		self.assertIn("Platos populares: paella", content)

	def test_log_agent_turn(self):
		filepath = self.logger.log_agent_turn(
			session_id="sub_agent_session",
			agent_name="researcher",
			prompt="Eres un investigador técnico.",
			response="Informe completado con datos rigurosos.",
			is_cached=True,
			cache_info="hash_sha256_abcd1234"
		)
		self.assertTrue(filepath.endswith("001-agent-researcher.md"))

		with open(filepath, "r", encoding="utf-8") as f:
			content = f.read()

		self.assertIn("category: agent_execution", content)
		self.assertIn("cached: true", content)
		self.assertIn("hash_sha256_abcd1234", content)
		self.assertIn("Informe completado", content)

	def test_log_plan_step(self):
		filepath = self.logger.log_plan_step(
			session_id="cumple_session",
			step_id=1,
			description="Consultar previsión meteorológica",
			context_given="Sin lluvia prevista",
			result="Miércoles despejado de 18:00 a 23:00"
		)
		self.assertTrue(filepath.endswith("001-plan-step-1.md"))

		with open(filepath, "r", encoding="utf-8") as f:
			content = f.read()

		self.assertIn("category: plan_step", content)
		self.assertIn("Paso de Planificación #1", content)
		self.assertIn("Miércoles despejado", content)

	def test_list_and_filter_files(self):
		sess_id = "test_filter"
		self.logger.log_user_turn(sess_id, "hola", "sys", "rag", [], "hola", "hola!")
		self.logger.log_tool_call(sess_id, "search_web", {"q": "test"}, "ok")
		self.logger.log_agent_turn(sess_id, "coder", "prompt", "code")

		convs = self.logger.list_conversations()
		self.assertEqual(len(convs), 1)
		sess_dir = convs[0]["session_dir"]

		files = self.logger.get_conversation_files(sess_dir)
		self.assertEqual(len(files), 3)

		categories = [f["category"] for f in files]
		self.assertIn("user_turn", categories)
		self.assertIn("tool_call", categories)
		self.assertIn("agent_execution", categories)

		# Content fetching
		user_file = next(f["filename"] for f in files if f["category"] == "user_turn")
		content = self.logger.get_file_content(sess_dir, user_file)
		self.assertIn("category: user_turn", content)

if __name__ == "__main__":
	unittest.main()
