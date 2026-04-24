import os

from dotenv import load_dotenv

from app import create_app

# Carregar variaveis de ambiente
load_dotenv()

app = create_app()


def _env_flag(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


if __name__ == "__main__":
    # Configuracoes de execucao
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    debug = _env_flag("FLASK_DEBUG", True)
    use_reloader = _env_flag("FLASK_USE_RELOADER", debug)
    reloader_type = os.getenv("FLASK_RELOADER_TYPE", "stat" if os.name == "nt" else "auto")

    default_excludes = [
        "*site-packages*",
        "*AppData\\Roaming\\Python*",
        "*AppData/Roaming/Python*",
    ]
    extra_excludes = [
        pattern.strip()
        for pattern in os.getenv("FLASK_RELOADER_EXCLUDE", "").split(",")
        if pattern.strip()
    ]
    exclude_patterns = default_excludes + extra_excludes

    print(f"NutriNow Backend iniciado em http://{host}:{port}")
    print(f"Reloader: {'on' if use_reloader else 'off'} | type={reloader_type}")

    app.run(
        host=host,
        port=port,
        debug=debug,
        use_reloader=use_reloader,
        reloader_type=reloader_type,
        exclude_patterns=exclude_patterns,
    )
