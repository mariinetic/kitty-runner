# Kitty Runner

Um jogo de plataforma em que a gatinha corre, pula obstáculos e coleta coracoes.
O projeto combina um frontend em JavaScript puro com uma API Flask e
persistencia em MongoDB.

## Visao geral

- **Frontend:** HTML5 Canvas, CSS e JavaScript modular
- **Backend:** Python 3 + Flask
- **Banco:** MongoDB via PyMongo
- **Dependencias:** Flask e PyMongo, listadas em `requirements.txt`
- **Execucao:** servidor local em `http://127.0.0.1:5000`

Tudo que aparece no jogo e desenhado no Canvas. Nao ha framework frontend nem
sprites externos: cenarios, personagem, inimigos, particulas e efeitos sonoros
sao gerados pelo proprio projeto.

## Requisitos

- Python 3.9 ou superior
- MongoDB Community Server ativo localmente ou uma conta MongoDB Atlas
- PowerShell, Terminal ou outro shell

O MongoDB local deve aceitar conexoes em:

```text
mongodb://127.0.0.1:27017
```

O MongoDB Compass e opcional, mas facilita a visualizacao dos documentos.

## Instalacao e execucao

Abra o PowerShell na pasta raiz do projeto:

```powershell
cd C:\caminho\para\kitty-runner
```

Crie e ative um ambiente virtual:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Instale as dependencias:

```powershell
pip install -r requirements.txt
```

Inicie o servidor:

```powershell
python app.py
```

Abra `http://127.0.0.1:5000` no navegador. Para parar o servidor, pressione
`Ctrl+C` no terminal.

Para executar os testes unitarios:

```powershell
pytest -q
```

## Configuracao do MongoDB

Sem configuracao adicional, o app usa:

```text
mongodb://localhost:27017/
```

Para usar o MongoDB Atlas no PowerShell, defina `MONGO_URI` antes de iniciar:

```powershell
$env:MONGO_URI = "mongodb+srv://usuario:senha@cluster.mongodb.net/"
python app.py
```

O banco utilizado pelo app e `kitty_runner`.

## Como os dados sao salvos

Uma partida enviada pelo frontend para `POST /api/score` e salva em tres
colecoes:

| Colecao | Finalidade |
| --- | --- |
| `players` | Perfil, nivel, XP, missoes, conquistas e recordes do jogador |
| `runs` | Historico individual de cada partida |
| `scores` | Pontuacoes usadas no ranking |

O jogador recebe um `player_id` persistido no `localStorage` do navegador.
Assim, o perfil pode ser recuperado quando ele volta ao jogo.

Ao terminar uma partida, o backend:

1. Atualiza ou cria o perfil em `players`.
2. Insere os detalhes da partida em `runs`.
3. Insere a pontuacao em `scores`.
4. Calcula a colocacao no ranking e devolve o perfil atualizado.

## Visualizando os documentos

No MongoDB Compass, use esta connection string:

```text
mongodb://127.0.0.1:27017
```

Em seguida, abra `kitty_runner` e escolha `players`, `runs` ou `scores`.

Tambem e possivel consultar pelo Python:

```powershell
python -c "from pymongo import MongoClient; db = MongoClient('mongodb://127.0.0.1:27017/')['kitty_runner']; print(db.list_collection_names()); print(list(db.players.find({}, {'_id': 0}))); print(list(db.runs.find({}, {'_id': 0}).sort('created_at', -1).limit(10))); print(list(db.scores.find({}, {'_id': 0}).sort('score', -1).limit(10)))"
```

## Como jogar

- **Pular:** `Espaco`, `Seta para cima` ou toque na parte superior da tela.
- **Pulo duplo:** a gatinha pode pular duas vezes; soltar a tecla reduz o pulo.
- **Abaixar:** `Seta para baixo`, `S` ou toque na parte inferior da tela.
- **Pausar:** `P`, `Esc` ou o botao de pausa.
- **Som:** use o botao de audio no HUD.
- **Objetivo:** desvie dos inimigos, colete coracoes e alcance a maior pontuacao.

No celular, os controles de pular e abaixar aparecem abaixo do jogo.

## Rotas da API

| Metodo | Rota | Funcao |
| --- | --- | --- |
| `GET` | `/api/leaderboard` | Retorna as 10 maiores pontuacoes |
| `DELETE` | `/api/leaderboard` | Remove todas as pontuacoes |
| `GET` | `/api/profile/<player_id>` | Consulta um perfil |
| `PUT` | `/api/profile/<player_id>` | Atualiza o progresso do perfil |
| `POST` | `/api/score` | Salva uma pontuacao ou uma partida completa |
| `POST` | `/api/run` | Salva diretamente uma partida completa |

O endpoint `DELETE /api/leaderboard` nao possui autenticacao e deve ser usado
apenas em ambiente local ou de demonstracao.

## Estrutura

```text
kitty-runner/
├── app.py                 # Ponto de entrada do servidor
├── requirements.txt       # Dependencias Python
├── README.md              # Documentacao
├── backend/
│   ├── api/               # Rotas HTTP e adaptadores Flask
│   ├── application/       # Casos de uso e regras do jogo
│   ├── core/              # Configuracao e modelos de dominio
│   └── infrastructure/    # Persistencia MongoDB
├── frontend/
│   ├── templates/         # Estrutura HTML da pagina
│   ├── static/            # CSS e JavaScript do jogo
│   └── assets/Images/     # Imagens e recursos visuais
└── tests/                 # Testes unitarios do backend
```

## Arquitetura

O backend usa uma Application Factory (`create_app`), Service Layer (`GameService`)
e Repository Pattern (`MongoRepository`). Essa separacao permite testar as regras
do jogo sem iniciar o Flask ou conectar ao MongoDB. O frontend permanece em
JavaScript puro e continua consumindo as mesmas rotas HTTP.
