NATIVE_TOOLS = [
	{
		"type": "function",
		"function": {
			"name": "search_web",
			"description": "Busca en internet información actualizada sobre eventos, noticias, meteorología o datos recientes.",
			"parameters": {
				"type": "object",
				"properties": {
					"query": {
						"type": "string",
						"description": "Texto exacto o término a buscar en la web."
					}
				},
				"required": ["query"]
			}
		}
	},
	{
		"type": "function",
		"function": {
			"name": "read_url",
			"description": "Descarga y extrae el texto principal en formato markdown de una página web.",
			"parameters": {
				"type": "object",
				"properties": {
					"url": {
						"type": "string",
						"description": "URL completa http o https de la página web a leer."
					}
				},
				"required": ["url"]
			}
		}
	},
	{
		"type": "function",
		"function": {
			"name": "read_pdf",
			"description": "Descarga y extrae el contenido de texto de un archivo PDF ubicado en una URL.",
			"parameters": {
				"type": "object",
				"properties": {
					"url": {
						"type": "string",
						"description": "URL completa del documento PDF a procesar."
					}
				},
				"required": ["url"]
			}
		}
	}
]
