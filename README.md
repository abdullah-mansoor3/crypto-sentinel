# 🛡️ Crypto Sentinel

<div align="center">

**AI-Powered Cryptocurrency Analysis Platform**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)](https://fastapi.tiangolo.com)
[![LangChain](https://img.shields.io/badge/LangChain-1.0-orange.svg)](https://langchain.com)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Directory Structure](#-directory-structure)
- [Getting Started](#-getting-started)
- [Docker Deployment](#-docker-deployment)
- [API Endpoints](#-api-endpoints)
- [How It Works](#-how-it-works)
- [Environment Variables](#-environment-variables)

---

## 🎯 Overview

Crypto Sentinel is a comprehensive cryptocurrency analysis platform that combines **real-time market data**, **technical indicators**, **quantitative risk metrics**, and **AI-powered sentiment analysis** into a unified dashboard. The platform features a multi-agent AI system that provides actionable investment insights.

---

## ✨ Features

### 📊 Technical Analysis
- **Real-time OHLCV Data**: Fetches live price data from CoinGecko API
- **Technical Indicators**: RSI, MACD, EMA (20/50), Bollinger Bands
- **Interactive Charts**: Candlestick charts with indicator overlays using Recharts
- **Support/Resistance Levels**: Automatically identified key price levels
- **Trend Detection**: Bullish/Bearish/Neutral signal aggregation

### 📈 Quantitative Metrics
- **Return Analysis**: Total return, annualized return, best/worst days
- **Risk Metrics**: Volatility, Sharpe Ratio, Sortino Ratio, Max Drawdown
- **Value at Risk (VaR)**: 95% VaR and Conditional VaR calculations
- **Risk Classification**: Low/Moderate/High/Extreme risk levels

### 📰 News Sentiment Analysis
- **Real-time News Feed**: Aggregated from CryptoPanic API
- **AI Sentiment Scoring**: RoBERTa transformer model for sentiment classification
- **Sentiment Aggregation**: Overall market sentiment (Bullish/Bearish/Neutral)
- **Impact Ranking**: Top news sorted by market impact

### 🤖 Multi-Agent AI Analysis
- **Orchestrator Agent**: Coordinates specialized sub-agents using ReAct reasoning
- **News Sentiment Agent**: Analyzes market sentiment from news
- **Technical Analysis Agent**: Interprets indicator signals
- **Quantitative Metrics Agent**: Assesses risk/reward profile
- **Real-time Progress**: WebSocket streaming of analysis steps
- **Final Recommendation**: Buy/Hold/Sell with confidence score

### 📚 Learn Section
- Educational content about technical indicators
- Risk metrics explanations
- Cryptocurrency fundamentals

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **FastAPI** | High-performance async web framework |
| **LangChain** | AI agent orchestration framework |
| **Groq (Llama 3.3 70B)** | LLM for analysis synthesis |
| **HuggingFace Transformers** | RoBERTa sentiment model |
| **Pandas/NumPy** | Data processing and calculations |
| **ChromaDB** | Vector storage (optional embeddings) |

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Utility-first styling |
| **Recharts** | Interactive charting library |
| **Lucide Icons** | Modern icon set |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **WebSocket** | Real-time streaming |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                             │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌─────────┐ ┌───────────────────┐  │
│  │Dashboard │ │ Technical │ │  Quant   │ │Sentiment│ │    AI Analysis    │  │
│  │  Page    │ │   Page    │ │  Page    │ │  Page   │ │  (WebSocket)      │  │
│  └────┬─────┘ └─────┬─────┘ └────┬─────┘ └────┬────┘ └─────────┬─────────┘  │
└───────┼─────────────┼────────────┼────────────┼─────────────────┼───────────┘
        │             │            │            │                 │
        │         HTTP REST        │            │            WebSocket
        │             │            │            │                 │
┌───────▼─────────────▼────────────▼────────────▼─────────────────▼───────────┐
│                              BACKEND (FastAPI)                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           API Routes                                │   │
│  │  /api/data    /api/technical    /api/quant    /api/agents/ws/analyze│   │
│  └───────┬──────────────┬──────────────┬────────────────┬──────────────┘   │
│          │              │              │                │                   │
│  ┌───────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐ ┌───────▼────────────────┐ │
│  │ Market Data  │ │ Technical │ │    Quant    │ │   Agent Controller     │ │
│  │   Fetcher    │ │ Indicators│ │   Metrics   │ │                        │ │
│  └───────┬──────┘ └─────┬─────┘ └──────┬──────┘ │  ┌──────────────────┐  │ │
│          │              │              │        │  │  Orchestrator    │  │ │
│          └──────────────┴──────────────┘        │  │     Agent        │  │ │
│                         │                       │  └────────┬─────────┘  │ │
│                         │                       │           │            │ │
│                         ▼                       │  ┌────────┼────────┐   │ │
│                  ┌──────────────┐               │  │        │        │   │ │
│                  │  Disk Cache  │               │  ▼        ▼        ▼   │ │
│                  │  (.cache/)   │               │ News   Technical Quant │ │
│                  └──────────────┘               │ Agent   Agent   Agent  │ │
│                                                 └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                        │
                    ▼                                        ▼
        ┌───────────────────┐                    ┌───────────────────┐
        │  External APIs    │                    │    Groq LLM API   │
        │  - CoinGecko      │                    │  (Llama 3.3 70B)  │
        │  - CryptoPanic    │                    └───────────────────┘
        └───────────────────┘
```

---

## 📁 Directory Structure

```
crypto-sentinel/
├── backend/
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # Configuration & environment variables
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Backend container definition
│   ├── .env                    # Environment variables (create this)
│   │
│   ├── ai/                     # AI Agent System
│   │   ├── schemas.py          # Pydantic schemas (MCP-style contracts)
│   │   ├── sub_agents.py       # News, Technical, Quant agents
│   │   └── agent_controller.py # Orchestrator agent (ReAct loop)
│   │
│   ├── analysis/               # Quantitative Analysis
│   │   ├── indicators.py       # Technical indicator calculations
│   │   └── quant_metrics.py    # Risk/return metric calculations
│   │
│   ├── data/                   # Data Fetching
│   │   ├── fetch_market.py     # CoinGecko API integration
│   │   ├── fetch_news.py       # CryptoPanic API + sentiment
│   │   └── tools.py            # Data tool wrappers for agents
│   │
│   ├── routes/                 # API Endpoints
│   │   ├── market.py           # /api/data/* endpoints
│   │   ├── technical.py        # /api/technical/* endpoints
│   │   ├── quant.py            # /api/quant/* endpoints
│   │   └── agents.py           # /api/agents/* + WebSocket
│   │
│   └── utils/                  # Utilities
│       └── cache.py            # Disk caching utilities
│
├── frontend/
│   ├── package.json            # Node.js dependencies
│   ├── next.config.ts          # Next.js configuration
│   ├── tailwind.config.ts      # Tailwind CSS configuration
│   ├── Dockerfile              # Frontend container definition
│   │
│   └── app/                    # Next.js App Router
│       ├── page.tsx            # Home/Dashboard page
│       ├── layout.tsx          # Root layout with navigation
│       ├── globals.css         # Global styles
│       │
│       ├── technical/          # Technical Analysis page
│       │   └── page.tsx
│       │
│       ├── quant/              # Quantitative Metrics page
│       │   └── page.tsx
│       │
│       ├── sentiment/          # News Sentiment page
│       │   └── page.tsx
│       │
│       ├── ai/                 # AI Agent Analysis page
│       │   └── page.tsx
│       │
│       ├── learn/              # Educational content
│       │   └── page.tsx
│       │
│       └── components/         # Reusable UI components
│           ├── Navbar.tsx
│           └── ...
│
├── docker-compose.yml          # Multi-container orchestration
└── README.md                   # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **npm** or **yarn**
- API Keys:
  - [CryptoPanic API Key](https://cryptopanic.com/developers/api/) (free tier available)
  - [Groq API Key](https://console.groq.com/) (free tier available)

### 1. Clone the Repository

```bash
git clone https://github.com/abdullah-mansoor3/crypto-sentinel.git
cd crypto-sentinel
```

### 2. Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cat > .env << EOF
CRYPTOPANIC_API_KEY=your_cryptopanic_api_key
GROQ_API_KEY=your_groq_api_key
EMBEDDINGS_ENABLED=0
EOF

# Run the backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
# Open new terminal, navigate to frontend
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend will be available at: `http://localhost:3000`

---

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
# From project root
# Make sure backend/.env exists with your API keys

# Build and start all services
docker compose up --build

# Run in detached mode
docker compose up -d --build

# View logs
docker compose logs -f

# Stop services
docker compose down
```

Services will be available at:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

### Build Individual Images

```bash
# Build backend
docker build -t crypto-sentinel-backend ./backend

# Build frontend
docker build -t crypto-sentinel-frontend \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 \
  ./frontend

# Run backend
docker run -d \
  --name backend \
  -p 8000:8000 \
  --env-file backend/.env \
  crypto-sentinel-backend

# Run frontend
docker run -d \
  --name frontend \
  -p 3000:3000 \
  crypto-sentinel-frontend
```

---

## 📡 API Endpoints

### Market Data
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data/ohlcv/{symbol}` | GET | OHLCV candlestick data |
| `/api/data/price/{symbol}` | GET | Current price |

### Technical Analysis
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/technical/indicators/{symbol}` | GET | All technical indicators |
| `/api/technical/signals/{symbol}` | GET | Buy/sell signals |

### Quantitative Metrics
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/quant/metrics/{symbol}` | GET | Risk/return metrics |
| `/api/quant/var/{symbol}` | GET | Value at Risk |

### AI Agents
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents/analyze` | POST | Run full analysis |
| `/api/agents/ws/analyze` | WebSocket | Streaming analysis |
| `/api/agents/health` | GET | Agent system health |

---

## ⚙️ How It Works

### 1. Data Flow

```
User Request → Frontend → Backend API → External APIs → Cache → Response
                                              ↓
                                        CoinGecko (prices)
                                        CryptoPanic (news)
```

### 2. Technical Analysis Pipeline

```
1. Fetch OHLCV data from CoinGecko
2. Calculate indicators:
   - RSI: 14-period relative strength
   - MACD: 12/26/9 exponential moving averages
   - EMA: 20 and 50 period
   - Bollinger Bands: 20-period with 2 std dev
3. Generate signals (bullish/bearish/neutral)
4. Identify support/resistance levels
5. Return aggregated analysis
```

### 3. AI Agent Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR AGENT                           │
│                                                                 │
│  1. PLAN: Determine which sub-agents to call                   │
│      ↓                                                          │
│  2. ACT: Call News Agent                                       │
│      → Fetch news from CryptoPanic                             │
│      → Run RoBERTa sentiment model                             │
│      → LLM summarizes sentiment                                │
│      ↓                                                          │
│  3. ACT: Call Technical Agent                                  │
│      → Fetch indicators from data layer                        │
│      → Interpret RSI, MACD, EMA, BBands                        │
│      → LLM generates trend summary                             │
│      ↓                                                          │
│  4. ACT: Call Quant Agent                                      │
│      → Calculate Sharpe, Sortino, VaR, etc.                    │
│      → Assess risk level                                       │
│      → LLM generates risk summary                              │
│      ↓                                                          │
│  5. SYNTHESIZE: Combine all results                            │
│      → LLM generates final analysis                            │
│      → Output: recommendation + confidence + risk level        │
└─────────────────────────────────────────────────────────────────┘
```

### 4. WebSocket Streaming

The AI analysis uses WebSocket for real-time progress updates:

```
Client                          Server
  │                               │
  │──── Connect to WebSocket ────►│
  │                               │
  │──── Send {coin: "BTC"} ──────►│
  │                               │
  │◄─── Progress: "Starting..." ──│
  │◄─── Progress: "News done" ────│
  │◄─── Progress: "Tech done" ────│
  │◄─── Progress: "Quant done" ───│
  │◄─── Complete: {full_result} ──│
  │                               │
```

---

## 🔐 Environment Variables

Create `backend/.env`:

```env
# Required
CRYPTOPANIC_API_KEY=your_key_here    # For news fetching
GROQ_API_KEY=your_key_here           # For LLM (Llama 3.3)

# Optional
EMBEDDINGS_ENABLED=0                  # Set to 1 to enable ChromaDB embeddings
MARKET_CACHE_TTL_SECONDS=3600        # Market data cache TTL (default: 1 hour)
TECHNICAL_CACHE_TTL_SECONDS=600      # Technical data cache TTL (default: 10 min)
NEWS_STALE_HOURS=6                   # News freshness threshold
NEWS_PRUNE_DAYS=30                   # Delete news older than this
```

---

## 📄 License

This project is for educational purposes.

---

## 🙏 Acknowledgments

- [CoinGecko](https://coingecko.com) for market data API
- [CryptoPanic](https://cryptopanic.com) for news aggregation API
- [Groq](https://groq.com) for fast LLM inference
- [LangChain](https://langchain.com) for agent framework
- [HuggingFace](https://huggingface.co) for sentiment models
