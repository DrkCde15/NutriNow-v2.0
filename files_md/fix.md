# Relatorio cirurgico de vulnerabilidades - NutriNow-2

Data da varredura: 2026-05-13

Escopo analisado:

- Backend Flask/Python em `NutriNow_BackEnd`.
- Frontend React/Vite em `Nutrinow_Frontend`.
- Configuracoes locais, arquivos de ambiente, lockfile npm e schema SQL.

Comandos e tecnicas usados:

- Mapeamento de arquivos com `rg --files` e leitura direcionada das rotas, servicos e configuracoes.
- Busca estatica por padroes perigosos: `localStorage`, `dangerouslySetInnerHTML`, `jwt_required`, `request.files`, `cursor.execute(f...)`, `str(e)`, OAuth, CORS, secrets e tokens.
- Verificacao de versionamento de `.env` com `git ls-files`, `git check-ignore` e `git status --ignored`.
- Auditoria npm com `npm.cmd audit --json --cache C:\tmp\npm-cache`.
- Conferencia da arvore afetada com `npm.cmd ls postcss --depth=4`.
- Tentativa de auditoria Python com `pip-audit`; a ferramenta nao estava instalada inicialmente e a auditoria efetiva nao foi concluida de forma confiavel. O proprio `requirements.txt` sem versoes pinadas limita a verificacao de CVEs.

Observacao de sigilo:

- O arquivo `NutriNow_BackEnd/.env` existe, mas esta ignorado por `NutriNow_BackEnd/.gitignore:1` e nao apareceu como versionado no `git ls-files`.
- Nao reproduzi valores de secrets neste relatorio.
- A checagem local indicou varias chaves preenchidas e um segredo curto por heuristica de tamanho. Se esse `.env` for reutilizado em ambiente real, rotacione os segredos.

## Resumo executivo

O projeto tem boa base contra SQL injection nas rotas principais, pois a maioria das queries usa parametros. Os maiores riscos estao em autenticacao/OAuth, exposicao de tokens no navegador, configuracao insegura para producao, ausencia de rate limiting, uploads sem limite/validacao e tokens OAuth armazenados em texto claro.

Achados por severidade:

- Critico: 1
- Alto: 8
- Medio: 10
- Baixo/operacional: 7

Prioridade sugerida:

1. Corrigir o fluxo Google OAuth de login: state assinado, redirect allowlist e nunca enviar JWT na URL.
2. Mudar armazenamento de autenticacao para cookie `HttpOnly`, `Secure`, `SameSite` ou token curto em memoria com refresh seguro.
3. Desligar debug/insecure OAuth em producao e validar secrets obrigatorios no boot.
4. Colocar rate limiting em login, cadastro, reset, chat, feedback e upload.
5. Travar uploads: tamanho, MIME real, extensoes, pasta segura e nao retornar caminho local.
6. Criptografar tokens Google Calendar em repouso.
7. Pinagem/auditoria de dependencias Python e corrigir `postcss`.

## Achado 1 - Critico - OAuth de login permite redirect nao confiavel e vazamento de JWT na URL

Evidencia:

- `NutriNow_BackEnd/app/routes/auth.py:135` usa `Origin` ou `request.referrer` como origem do frontend.
- `NutriNow_BackEnd/app/routes/auth.py:143` coloca essa origem diretamente no `state`.
- `NutriNow_BackEnd/app/routes/auth.py:207` aceita `state` como `target_url`.
- `NutriNow_BackEnd/app/routes/auth.py:210` redireciona para `target_url` com `access_token`, `user_id`, `user_name` e `user_email` na query string.
- `Nutrinow_Frontend/src/lib/auth.tsx:103-114` le o token da URL e so depois limpa a URL com `replaceState`.

Impacto:

- Um `state` nao assinado/nao validado vira open redirect.
- O JWT vai para URL, historico do browser, logs de proxy, logs de servidor, ferramentas de analytics e possivel header `Referer`.
- Se a origem for manipulada, o token pode ser entregue a um dominio externo.
- `user_name` e `user_email` tambem sao interpolados sem `urlencode`, o que pode quebrar parametros e abrir margem para injecao de query.

Correcao recomendada:

- Trocar o `state` por payload assinado com `itsdangerous.URLSafeTimedSerializer`, igual ao fluxo de Calendar, contendo nonce, origem allowlisted e expiracao curta.
- Validar a origem final contra allowlist fechada: `FRONTEND_URL` e dominios explicitamente permitidos.
- Nao retornar JWT em query string. Opcoes seguras:
  - backend cria cookie `HttpOnly; Secure; SameSite=Lax/Strict`;
  - ou callback redireciona com um codigo curto de uso unico, e o frontend troca esse codigo por token via `POST`.
- Construir query strings com `urllib.parse.urlencode`.
- Usar redirect URI configuravel por ambiente e HTTPS em producao.

## Achado 2 - Alto - JWT persistido em localStorage aumenta impacto de XSS

Evidencia:

- `Nutrinow_Frontend/src/lib/auth.tsx:67` le sessao do `localStorage`.
- `Nutrinow_Frontend/src/lib/auth.tsx:93` grava token e usuario no `localStorage`.
- `Nutrinow_Frontend/src/lib/auth.tsx:175-176` atualiza sessao novamente no `localStorage`.
- `NutriNow_BackEnd/app/__init__.py:48` usa JWT com expiracao de 30 dias.

Impacto:

- Qualquer XSS ou dependencia maliciosa executando no contexto do app consegue roubar o JWT.
- Como o token dura 30 dias e nao ha revoke list, o logout nao invalida tokens emitidos.

Correcao recomendada:

- Preferir cookie `HttpOnly`, `Secure`, `SameSite=Lax/Strict`.
- Se mantiver bearer token, usar access token curto em memoria e refresh token rotacionado em cookie seguro.
- Implementar `jti` + tabela/lista de revogacao ou controle de sessoes.
- Reduzir expiracao do access token para minutos, nao 30 dias.

## Achado 3 - Alto - Debug e OAuth inseguro podem ficar ativos por padrao

Evidencia:

- `NutriNow_BackEnd/App.py:24` usa `FLASK_DEBUG` com default `True`.
- `NutriNow_BackEnd/App.py:43` executa `app.run(...)` com esse debug.
- `NutriNow_BackEnd/app/__init__.py:44` define `OAUTHLIB_INSECURE_TRANSPORT=1` sempre.

Impacto:

- Debug do Flask em ambiente exposto pode vazar stack traces, variaveis e detalhes internos.
- `OAUTHLIB_INSECURE_TRANSPORT=1` permite fluxo OAuth sem HTTPS, aceitavel apenas em desenvolvimento local.

Correcao recomendada:

- Default de debug deve ser `False`.
- Falhar o boot se `FLASK_DEBUG=true` em producao.
- Definir `OAUTHLIB_INSECURE_TRANSPORT=1` apenas quando `FLASK_ENV=development`.
- Usar servidor WSGI real em producao.

## Achado 4 - Alto - CORS com credenciais e origens amplas

Evidencia:

- `NutriNow_BackEnd/app/__init__.py:17-22` permite varias origens locais por padrao.
- `NutriNow_BackEnd/app/__init__.py:25-33` adiciona origens vindas de env sem normalizacao forte.
- `NutriNow_BackEnd/app/__init__.py:55-59` ativa CORS com `supports_credentials=True`.

Impacto:

- Hoje a API usa `Authorization: Bearer`, entao `supports_credentials=True` parece desnecessario.
- Se cookies forem adotados depois sem endurecer CORS/CSRF, aumenta risco de abuso cross-site.
- Ambientes mal configurados podem liberar origens demais.

Correcao recomendada:

- Remover `supports_credentials=True` enquanto nao houver cookies.
- Em producao, usar allowlist exata, sem defaults locais.
- Validar `CORS_ORIGINS` no boot e recusar `*`.
- Se migrar para cookies, adicionar protecao CSRF.

## Achado 5 - Alto - Sem rate limiting em endpoints sensiveis

Evidencia:

- Login: `NutriNow_BackEnd/app/routes/auth.py:103-127`.
- Cadastro: `NutriNow_BackEnd/app/routes/auth.py:58-100`.
- Recuperacao de senha: `NutriNow_BackEnd/app/routes/auth.py:246-273`.
- Redefinicao: `NutriNow_BackEnd/app/routes/auth.py:276-296`.
- Chat/IA: `NutriNow_BackEnd/app/routes/chatbot.py:16-31`.
- Upload de imagem: `NutriNow_BackEnd/app/routes/chatbot.py:50-95`.
- Feedback publico: `NutriNow_BackEnd/app/routes/feedbacks.py:58-127`.

Impacto:

- Brute force de senha.
- Enumeracao e abuso de reset por email.
- Consumo de cota Groq e SMTP.
- DoS de CPU, banco e disco via chat/upload/feedback.

Correcao recomendada:

- Adicionar Flask-Limiter ou rate limiter no proxy.
- Regras minimas:
  - login: por IP + email, com backoff progressivo;
  - reset: por IP + email;
  - chat: por usuario e por IP;
  - upload: por usuario e tamanho;
  - feedback: por IP e captcha/honeypot se publico.

## Achado 6 - Alto - Upload de imagem sem limite, sem validacao real e com vazamento de caminho local

Evidencia:

- `NutriNow_BackEnd/app/routes/chatbot.py:12` usa pasta absoluta `C:\Users\...`.
- `NutriNow_BackEnd/app/routes/chatbot.py:64-74` aceita `request.files['file']`, usa extensao original e salva direto.
- `NutriNow_BackEnd/app/routes/chatbot.py:78-79` persiste o caminho local completo.
- `NutriNow_BackEnd/app/routes/chatbot.py:89` retorna `file_path` ao cliente.
- Nao ha `MAX_CONTENT_LENGTH` visivel em `app/__init__.py`.

Impacto:

- DoS por upload grande ou muitos uploads.
- Upload de arquivo nao-imagem renomeado com extensao de imagem.
- Exposicao do caminho interno do servidor e nome de usuario local.
- Risco operacional se a pasta absoluta nao existir ou tiver permissoes erradas em producao.

Correcao recomendada:

- Definir `app.config['MAX_CONTENT_LENGTH']`.
- Validar MIME pelo conteudo, nao so extensao. Exemplo: `python-magic` ou Pillow verificando imagem.
- Permitir apenas extensoes conhecidas e normalizadas.
- Salvar em pasta configurada por env, fora de diretorio publico, com permissao restrita.
- Retornar apenas ID do upload, nunca caminho absoluto.
- Aplicar limpeza/retencao de arquivos.

## Achado 7 - Alto - Tokens Google Calendar armazenados em texto claro

Evidencia:

- `NutriNow_BackEnd/app/routes/calendar.py:24-28` cria tabela com `access_token TEXT` e `refresh_token TEXT`.
- `NutriNow_BackEnd/SQL.txt:107-108` replica o mesmo modelo.

Impacto:

- Comprometimento do banco permite acesso direto ao Google Calendar dos usuarios enquanto tokens forem validos.
- Refresh tokens podem permitir acesso prolongado.

Correcao recomendada:

- Criptografar tokens em repouso com envelope encryption.
- Guardar chave fora do banco, em secret manager/KMS.
- Rotacionar tokens ao detectar exposicao.
- Registrar escopo minimo e permitir revogacao por usuario.

## Achado 8 - Alto - DDL executado em runtime exige privilegios excessivos no usuario do banco

Evidencia:

- `NutriNow_BackEnd/app/routes/fitness.py:16-37` executa `ALTER TABLE` para criar colunas.
- `NutriNow_BackEnd/app/routes/calendar.py:282-303` repete `ALTER TABLE`.
- Essas funcoes sao chamadas durante requests em `fitness.py:124`, `fitness.py:174`, `fitness.py:277`, `calendar.py:307`, `calendar.py:506`.

Impacto:

- O usuario da aplicacao precisa permissao de `ALTER`, violando menor privilegio.
- Requisicoes podem causar locks de tabela, indisponibilidade e comportamento dificil de auditar.
- Falhas de migracao aparecem em runtime, nao em deploy controlado.

Correcao recomendada:

- Remover DDL das rotas.
- Usar migracoes versionadas, por exemplo Alembic/Flask-Migrate.
- Usuario runtime do banco deve ter apenas `SELECT`, `INSERT`, `UPDATE`, `DELETE` nas tabelas necessarias.

## Achado 9 - Alto - Cache de agentes em memoria e session_id arbitrario permitem DoS de memoria

Evidencia:

- `NutriNow_BackEnd/app/services/agent_service.py:8` define `agent_cache = {}` global.
- `NutriNow_BackEnd/app/services/agent_service.py:14-21` usa `user_id_session_id` como chave e nunca limita tamanho/TTL.
- `NutriNow_BackEnd/app/routes/chatbot.py:25` aceita `X-Session-ID` ou `session_id` do cliente.

Impacto:

- Um usuario autenticado pode criar muitos `session_id` diferentes e fazer o processo acumular objetos indefinidamente.
- Em multiplos workers, o estado fica inconsistente e nao escalavel.

Correcao recomendada:

- Remover cache global ou usar LRU/TTL com limite por usuario.
- Validar tamanho/formato de `session_id`.
- Armazenar estado necessario em banco/Redis com expiracao.

## Achado 10 - Medio - Recuperacao de senha permite enumeracao e tokens ficam em texto claro

Evidencia:

- `NutriNow_BackEnd/app/routes/auth.py:257` retorna `404` com mensagem de email nao cadastrado.
- `NutriNow_BackEnd/app/routes/auth.py:259-263` gera token e insere direto em `redefinicao_senha`.
- `NutriNow_BackEnd/app/routes/auth.py:290-292` redefine senha e deleta apenas o token usado.
- `NutriNow_BackEnd/SQL.txt:28-34` armazena `token VARCHAR(255)` sem hash.

Impacto:

- Atacante pode descobrir quais emails existem.
- Vazamento de banco permite usar tokens de reset ainda validos.
- Multiplos tokens antigos podem continuar validos ate expirarem.

Correcao recomendada:

- Sempre responder mensagem generica e status 200: "se existir, enviaremos".
- Armazenar hash do token, nao o token puro.
- Invalidar todos os tokens anteriores do usuario ao emitir um novo e ao trocar senha.
- Adicionar indice unico/hash e rotina de expiracao.
- Rate limit por IP e email.

## Achado 11 - Medio - Politica de senha so existe parcialmente no frontend

Evidencia:

- `Nutrinow_Frontend/src/routes/cadastro.tsx:39` considera forte apenas `senha.length >= 6`.
- `Nutrinow_Frontend/src/routes/reset-senha.tsx:35` valida 6 caracteres.
- `NutriNow_BackEnd/app/routes/auth.py:61-84` cadastra senha sem regra minima no backend.
- `NutriNow_BackEnd/app/routes/auth.py:277-290` redefine senha sem regra minima no backend.

Impacto:

- Cliente pode ser burlado com chamada direta a API.
- Senhas fracas aumentam risco de brute force e credential stuffing.

Correcao recomendada:

- Validar no backend tamanho minimo e lista de senhas comuns.
- Usar politica razoavel: minimo 10-12 caracteres, bloqueio de senhas vazadas e rate limiting.
- Opcional: zxcvbn no frontend apenas como feedback, nao como unica protecao.

## Achado 12 - Medio - Mensagens de erro internas sao retornadas ao cliente

Evidencia:

- `NutriNow_BackEnd/app/routes/profile.py:232`, `316`, `331`, `433`.
- `NutriNow_BackEnd/app/routes/auth.py:273`, `296`.
- `NutriNow_BackEnd/app/routes/fitness.py:389`.
- `NutriNow_BackEnd/app/routes/chatbot.py:95`.

Impacto:

- Pode vazar nomes de tabelas, queries, paths, stack/contexto de integracoes e detalhes de configuracao.

Correcao recomendada:

- Retornar mensagens genericas e um `error_id`.
- Logar detalhes apenas no servidor, com sanitizacao.
- Garantir que logs nao contenham tokens ou secrets.

## Achado 13 - Medio - Chamadas externas sem timeout no fluxo Google OAuth de login

Evidencia:

- `NutriNow_BackEnd/app/routes/auth.py:45` faz `requests.get` sem timeout.
- `NutriNow_BackEnd/app/routes/auth.py:163-168` faz `requests.post` sem timeout.
- `NutriNow_BackEnd/app/routes/auth.py:172` faz `requests.get` sem timeout.
- O fluxo Calendar ja usa timeout em `calendar.py:117` e `calendar.py:414-423`.

Impacto:

- Requests pendurados podem consumir workers e causar DoS.

Correcao recomendada:

- Adicionar `timeout=10` ou similar em todas as chamadas externas.
- Cachear discovery document do Google por periodo curto.
- Validar `response.ok` antes de parsear JSON.

## Achado 14 - Medio - Dependencias Python sem pinagem e auditoria inconclusiva

Evidencia:

- `NutriNow_BackEnd/requirements.txt:1-12` lista pacotes sem versao fixa.
- O codigo importa `flask_jwt_extended` em `app/__init__.py:6` e `auth.py:7`, mas `Flask-JWT-Extended` nao aparece no `requirements.txt`.
- `langchain`, `langchain-community`, `langchain-core` e `ollama` aparecem em `requirements.txt:3-5` e `10`, mas o agente atual usa chamada HTTP direta para Groq em `NutriNow_BackEnd/Nutri.py:124-128`.

Impacto:

- Builds nao reprodutiveis.
- Auditoria de CVE por arquivo de requirements fica imprecisa.
- Dependencias nao usadas aumentam superficie de supply chain.
- Dependencia ausente pode quebrar deploy limpo.

Correcao recomendada:

- Pinagem com versoes exatas, por exemplo `Flask==x.y.z`.
- Gerar lock com `pip-tools`, Poetry ou uv.
- Adicionar `Flask-JWT-Extended`.
- Remover dependencias nao usadas ou mover para extras.
- Rodar `pip-audit`/Dependabot/Safety no CI.

## Achado 15 - Medio - `npm audit` encontrou vulnerabilidade em PostCSS

Evidencia:

- `npm audit` reportou 1 vulnerabilidade moderada:
  - pacote: `postcss`
  - advisory: `GHSA-qx2v-qp2m-jg93`
  - titulo: XSS via `</style>` nao escapado no stringify
  - CVSS: 6.1
  - range vulneravel: `<8.5.10`
- `Nutrinow_Frontend/package-lock.json:7646-7648` mostra `postcss@8.5.9`.
- `npm.cmd ls postcss --depth=4` mostrou `postcss@8.5.9` via `vite@7.3.2` e Tailwind ligado a `@lovable.dev/vite-tanstack-config`.

Impacto:

- Risco depende de CSS controlado por usuario passando por PostCSS. Mesmo que a explorabilidade pareca baixa neste app, e uma dependencia vulneravel confirmada.

Correcao recomendada:

- Rodar `npm audit fix` ou atualizar dependencias que puxam `postcss`.
- Confirmar que `package-lock.json` passa a resolver `postcss >= 8.5.10`.
- Manter Dependabot/Renovate ativo.

## Achado 16 - Medio - Feedback publico pode ser usado para abuso de SMTP e indisponibilidade

Evidencia:

- `NutriNow_BackEnd/app/routes/feedbacks.py:58-127` permite envio sem autenticacao obrigatoria.
- `NutriNow_BackEnd/app/routes/feedbacks.py:110-112` faz rollback se o email de notificacao falhar.
- `NutriNow_BackEnd/app/routes/feedbacks.py:31` chama `.strip()` direto em `os.getenv("EMAIL_SENDER")`.

Impacto:

- Endpoint publico pode gerar spam/custo/limite SMTP.
- Falha temporaria de email impede salvar feedback, criando acoplamento desnecessario.
- Se `EMAIL_SENDER` estiver ausente, `.strip()` causa erro.

Correcao recomendada:

- Rate limit e captcha/honeypot.
- Salvar feedback independentemente do email.
- Enviar notificacao de forma assincrona.
- Usar `(os.getenv("EMAIL_SENDER") or "").strip()`.

## Achado 17 - Medio - Dados sensiveis de saude sao enviados a terceiro sem barreira explicita de privacidade

Evidencia:

- `NutriNow_BackEnd/Nutri.py:297-306` monta contexto com meta, altura, peso e historico de treino.
- `NutriNow_BackEnd/Nutri.py:326-389` monta contexto de agenda/dieta/treino.
- `NutriNow_BackEnd/Nutri.py:124-128` envia mensagens e contexto para API Groq.

Impacto:

- O app processa dados potencialmente sensiveis de saude/habitos.
- Sem consentimento, minimizacao e politica clara, ha risco de privacidade e compliance.

Correcao recomendada:

- Exibir consentimento claro para IA.
- Minimizar contexto enviado.
- Permitir opt-out.
- Documentar retencao e terceiros.
- Evitar enviar dados desnecessarios ou identificadores diretos.

## Achado 18 - Medio - Falta de headers de seguranca HTTP

Evidencia:

- `NutriNow_BackEnd/app/__init__.py` configura CORS e blueprints, mas nao define CSP, HSTS, X-Content-Type-Options, Referrer-Policy ou frame protections.

Impacto:

- XSS e vazamentos de referrer ficam mais graves, especialmente porque tokens aparecem em URL no OAuth atual.

Correcao recomendada:

- Adicionar `Flask-Talisman` ou middleware proprio:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer` ou `strict-origin-when-cross-origin`
  - `X-Frame-Options` ou `frame-ancestors` via CSP.

## Achado 19 - Medio - Email e perfil podem ser alterados sem verificacao adicional

Evidencia:

- `NutriNow_BackEnd/app/routes/profile.py:239-282` aceita `email` no update de perfil.
- Nao ha confirmacao de senha, reautenticacao ou verificacao do novo email.

Impacto:

- Se o token for roubado, atacante pode trocar email da conta.
- Mesmo sem roubo, a conta pode assumir email nao verificado.

Correcao recomendada:

- Exigir senha atual ou reautenticacao para trocar email.
- Enviar confirmacao para o novo email antes de efetivar.
- Normalizar email e tratar conflito com resposta generica.

## Achado 20 - Medio - Entrada do chat nao tem limite de tamanho

Evidencia:

- `NutriNow_BackEnd/app/routes/chatbot.py:24-31` aceita `message` sem limite.
- `NutriNow_BackEnd/Nutri.py:458-468` adiciona mensagem ao prompt e envia para Groq.
- `NutriNow_BackEnd/Nutri.py:448-451` salva conteudo no banco sem limite de aplicacao.

Impacto:

- Alto custo de tokens.
- Latencia/DoS.
- Possiveis erros no banco se exceder limites.

Correcao recomendada:

- Limitar tamanho de mensagem, por exemplo 4-8 KB.
- Rate limit por usuario.
- Aplicar truncamento/normalizacao em historico.

## Achado 21 - Baixo/operacional - SQL schema inconsistente e com comandos destrutivos no mesmo arquivo

Evidencia:

- `NutriNow_BackEnd/SQL.txt:73-86` cria `dieta_treino` com coluna `usuario_id`, mas a FK usa `user_id`.
- O backend usa `user_id` em `fitness.py`, enquanto alguns helpers tentam detectar `user_id` ou `usuario_id`.
- `NutriNow_BackEnd/SQL.txt:134-141` contem `DELETE FROM ...` e resets de auto increment.
- `NutriNow_BackEnd/SQL.txt:143-146` contem `ALTER TABLE` avulsos.

Impacto:

- Deploy limpo pode falhar.
- Scripts operacionais misturam schema, consultas, deletes e migracoes.
- Risco de executar limpeza destrutiva por engano.

Correcao recomendada:

- Separar `schema.sql`, `seed.sql`, `migrations/` e scripts destrutivos.
- Padronizar coluna como `user_id` ou `usuario_id`, nao ambos.
- Usar migracoes versionadas.

## Achado 22 - Baixo/operacional - `.env` esta ignorado, mas falta higiene centralizada de secrets

Evidencia:

- `NutriNow_BackEnd/.gitignore:1` ignora `*.env`.
- `git status --ignored --short NutriNow_BackEnd/.env` mostrou o arquivo como ignorado.
- Nao ha `.gitignore` raiz, mas ha `.gitignore` especifico no backend e frontend.

Impacto:

- O estado atual evita commit acidental do `.env` do backend.
- Ainda assim, por ser um repo dividido, um `.env` criado fora dessas pastas pode nao ser ignorado.

Correcao recomendada:

- Adicionar `.gitignore` raiz com `.env`, `.env.*`, `!.env.example`, chaves e dumps.
- Manter apenas `.env.example` sem segredos.
- Rodar secret scanning no CI.

## Achado 23 - Baixo - `dangerouslySetInnerHTML` no chat esta defensivo hoje, mas e ponto sensivel

Evidencia:

- `Nutrinow_Frontend/src/routes/chat.tsx:315-323` escapa `&` e `<`, transforma `**...**` em `<strong>` e renderiza com `dangerouslySetInnerHTML`.

Analise:

- A implementacao atual escapa os vetores HTML obvios antes de inserir `<strong>`, entao nao identifiquei XSS direto nesse trecho.
- O risco cresce se mais Markdown/HTML for suportado no futuro.

Correcao recomendada:

- Preferir renderizador Markdown seguro com sanitizacao, por exemplo `react-markdown` + `rehype-sanitize`.
- Manter testes de XSS para respostas da IA.

## Achado 24 - Baixo - `chat_history` ignora session_id quando busca historico por usuario

Evidencia:

- `NutriNow_BackEnd/app/routes/chatbot.py:38` recebe `session_id`.
- `NutriNow_BackEnd/app/routes/chatbot.py:46` chama `get_conversation_history(by_user=True)`, o que retorna historico por usuario.

Impacto:

- Nao vi vazamento entre usuarios, pois filtra por `user_id`.
- Mas diferentes sessoes do mesmo usuario se misturam, o que pode vazar contexto entre conversas/dispositivos do proprio usuario.

Correcao recomendada:

- Se a UX espera conversas separadas, filtrar por `user_id` e `session_id`.

## Achado 25 - Baixo - Banco nao configura SSL/TLS

Evidencia:

- `NutriNow_BackEnd/app/database.py:6-12` cria conexao MySQL apenas com host, user, password e database.
- `NutriNow_BackEnd/Nutri.py:54-60` monta config similar.

Impacto:

- Em banco remoto, credenciais e dados podem trafegar sem TLS se o servidor/driver nao for forcado a usar SSL.

Correcao recomendada:

- Configurar `ssl_ca`, `ssl_verify_cert`/equivalente do connector em producao.
- Falhar boot se banco remoto estiver sem TLS.

## Achado 26 - Baixo - Falta validacao robusta de emails e campos numericos no backend

Evidencia:

- `NutriNow_BackEnd/app/routes/auth.py:61-84` aceita email e dados pessoais com validacao minima.
- `NutriNow_BackEnd/app/routes/profile.py:239-315` aceita altura, peso e email com pouca validacao server-side.

Impacto:

- Dados inconsistentes, erros SQL e maior superficie de abuso.

Correcao recomendada:

- Usar schemas Pydantic/Marshmallow para validar payloads.
- Normalizar email (`lower().strip()`).
- Aplicar ranges realistas para altura/peso/data.

## Achados positivos

- A maioria das queries usa parametros `%s`, reduzindo risco de SQL injection.
- Onde ha SQL dinamico, os nomes de coluna em geral vem de listas internas ou introspeccao restrita, nao diretamente do usuario.
- Rotas sensiveis de perfil, dieta/treino, calendario e chat usam `@jwt_required()`.
- O fluxo Google Calendar usa `state` assinado e com `max_age=600`, melhor que o fluxo Google login.
- Mensagens de feedback sao escapadas antes de montar HTML de email em `feedbacks.py:35-39`.
- O `.env` do backend esta ignorado pelo Git.

## Ordem de correcao sugerida

Primeiras 24-48 horas:

1. Corrigir OAuth login: state assinado, allowlist de redirect e fim de JWT na URL.
2. Reduzir expiracao do JWT e preparar revogacao.
3. Desligar debug por padrao e condicionar `OAUTHLIB_INSECURE_TRANSPORT`.
4. Adicionar rate limiting basico em login/reset/chat/upload/feedback.
5. Configurar `MAX_CONTENT_LENGTH` e bloquear uploads nao-imagem.
6. Rodar `npm audit fix` ou atualizar `postcss >= 8.5.10`.

Proxima etapa:

1. Migrar auth para cookie seguro ou access token em memoria + refresh seguro.
2. Criptografar tokens Google Calendar em repouso.
3. Remover DDL das rotas e adotar migracoes.
4. Pinagem de dependencias Python e CI com auditoria.
5. Implementar headers de seguranca e CSP.
6. Melhorar fluxo de reset de senha e politicas server-side.

Hardening continuo:

1. Secret scanning no CI.
2. Dependabot/Renovate para npm e Python.
3. Testes automatizados de auth, reset, upload e autorizacao por usuario.
4. Logs estruturados sem secrets.
5. Politica de privacidade/consentimento para envio de dados a IA.

## Checklist de verificacao apos correcoes

- `npm audit` sem vulnerabilidades conhecidas.
- `pip-audit` rodando contra lockfile Python pinado.
- Login Google nao coloca tokens em URL.
- Redirect OAuth falha para origem fora da allowlist.
- Token roubado antes do logout nao continua valido apos revogacao.
- Upload acima do limite retorna 413.
- Upload de arquivo falso com extensao `.jpg` e conteudo nao-imagem e rejeitado.
- Usuario A nao acessa dieta, perfil, calendario, upload ou chat do usuario B.
- `FLASK_DEBUG` default `false`.
- App falha no boot se `JWT_SECRET_KEY` ou `FLASK_SECRET_KEY` estiverem ausentes/fracos.
- Tokens Google Calendar nao aparecem em texto claro no banco.
