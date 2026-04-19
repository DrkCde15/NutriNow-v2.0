import os
from app import create_app
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

app = create_app()

if __name__ == "__main__":
    # Configurações de execução
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    
    print(f"🚀 NutriNow Backend iniciado em http://{host}:{port}")
    app.run(host=host, port=port, debug=debug)
