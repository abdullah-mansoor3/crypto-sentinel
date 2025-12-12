"""
Agent API routes with WebSocket support for real-time progress streaming.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
import logging

from ai.schemas import OrchestratorInput, OrchestratorOutput, ProgressUpdate
from ai.agent_controller import run_orchestrator, OrchestratorAgent
from config import GROQ_API_KEY

router = APIRouter()
logger = logging.getLogger("crypto-sentinel.routes.agents")


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class AnalysisRequest(BaseModel):
    """Request model for analysis endpoint"""
    coin: str = "BTC"
    days: int = 30
    include_news: bool = True
    include_technical: bool = True
    include_quant: bool = True


class AnalysisResponse(BaseModel):
    """Response wrapper for analysis results"""
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None


# =============================================================================
# HTTP ENDPOINTS
# =============================================================================

@router.get("/groq")
def test_groq_llm():
    """Test Groq LLM connectivity."""
    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage
        
        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=GROQ_API_KEY,
            temperature=0.1,
            max_tokens=100,
        )
        
        response = llm.invoke([HumanMessage(content="Say 'Groq is working!' in exactly 3 words.")])
        
        return {"success": True, "response": response.content}
    except Exception as e:
        logger.exception("Groq test failed")
        return {"success": False, "error": str(e)}


@router.post("/analyze")
async def analyze_coin(request: AnalysisRequest):
    """
    Run full analysis on a cryptocurrency.
    This is a synchronous endpoint - for streaming progress, use WebSocket.
    """
    try:
        logger.info(f"Starting analysis for {request.coin}")
        
        # Run orchestrator without progress callback (non-streaming)
        result = run_orchestrator(
            coin=request.coin,
            days=request.days,
            include_news=request.include_news,
            include_technical=request.include_technical,
            include_quant=request.include_quant,
            progress_callback=None
        )
        
        # Convert to dict for JSON response
        result_dict = result.model_dump()
        
        return AnalysisResponse(success=True, data=result_dict)
        
    except Exception as e:
        logger.exception(f"Analysis failed for {request.coin}")
        return AnalysisResponse(success=False, error=str(e))


@router.get("/analyze/{coin}")
async def analyze_coin_get(
    coin: str,
    days: int = 30,
    include_news: bool = True,
    include_technical: bool = True,
    include_quant: bool = True
):
    """GET version of analysis endpoint for simple requests."""
    request = AnalysisRequest(
        coin=coin.upper(),
        days=days,
        include_news=include_news,
        include_technical=include_technical,
        include_quant=include_quant
    )
    return await analyze_coin(request)


# =============================================================================
# WEBSOCKET ENDPOINT FOR STREAMING
# =============================================================================

class ConnectionManager:
    """Manages WebSocket connections."""
    
    def __init__(self):
        self.active_connections: list[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")
    
    async def send_json(self, websocket: WebSocket, data: dict):
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.warning(f"Failed to send WebSocket message: {e}")


manager = ConnectionManager()

# Allowed WebSocket origins
ALLOWED_WS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]


@router.websocket("/ws/analyze")
async def websocket_analyze(websocket: WebSocket):
    """
    WebSocket endpoint for streaming analysis progress.
    
    Client sends: {"coin": "BTC", "days": 30, ...}
    Server streams: ProgressUpdate messages followed by final OrchestratorOutput
    """
    # Check origin for WebSocket connections
    origin = websocket.headers.get("origin", "")
    if origin and origin not in ALLOWED_WS_ORIGINS:
        logger.warning(f"WebSocket connection rejected from origin: {origin}")
        await websocket.close(code=1008)
        return
    
    await manager.connect(websocket)
    
    try:
        while True:
            # Wait for analysis request
            data = await websocket.receive_text()
            
            try:
                request_data = json.loads(data)
                request = AnalysisRequest(**request_data)
            except (json.JSONDecodeError, ValueError) as e:
                await manager.send_json(websocket, {
                    "type": "error",
                    "message": f"Invalid request: {str(e)}"
                })
                continue
            
            logger.info(f"WebSocket analysis request for {request.coin}")
            
            # Create progress callback that sends to websocket
            progress_queue: asyncio.Queue = asyncio.Queue()
            
            # Capture the event loop BEFORE creating the callback
            main_loop = asyncio.get_running_loop()
            
            def progress_callback(update: ProgressUpdate):
                """Synchronous callback that puts updates in queue (thread-safe)."""
                try:
                    # Use the captured main_loop to schedule the put_nowait
                    main_loop.call_soon_threadsafe(
                        progress_queue.put_nowait, update.model_dump()
                    )
                except Exception as e:
                    logger.warning(f"Failed to queue progress: {e}")
            
            # Run analysis in background task
            analysis_task = asyncio.create_task(
                run_analysis_async(request, progress_callback)
            )
            
            # Stream progress updates while analysis runs
            while not analysis_task.done():
                try:
                    # Wait for progress update with timeout
                    update = await asyncio.wait_for(
                        progress_queue.get(),
                        timeout=0.5
                    )
                    await manager.send_json(websocket, update)
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    logger.warning(f"Error streaming progress: {e}")
            
            # Drain remaining progress updates
            while not progress_queue.empty():
                try:
                    update = progress_queue.get_nowait()
                    await manager.send_json(websocket, update)
                except:
                    break
            
            # Get final result
            try:
                result = await analysis_task
                await manager.send_json(websocket, {
                    "type": "complete",
                    "agent": "Orchestrator",
                    "message": "Analysis complete",
                    "data": result.model_dump()
                })
            except Exception as e:
                await manager.send_json(websocket, {
                    "type": "error",
                    "agent": "Orchestrator",
                    "message": f"Analysis failed: {str(e)}"
                })
    
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.exception("WebSocket error")
    finally:
        manager.disconnect(websocket)


async def run_analysis_async(
    request: AnalysisRequest,
    progress_callback
) -> OrchestratorOutput:
    """Run analysis in async context."""
    # Run synchronous orchestrator in thread pool
    loop = asyncio.get_event_loop()
    
    result = await loop.run_in_executor(
        None,
        lambda: run_orchestrator(
            coin=request.coin,
            days=request.days,
            include_news=request.include_news,
            include_technical=request.include_technical,
            include_quant=request.include_quant,
            progress_callback=progress_callback
        )
    )
    
    return result


# =============================================================================
# HEALTH CHECK
# =============================================================================

@router.get("/health")
def agent_health():
    """Check agent system health."""
    return {
        "status": "healthy",
        "groq_configured": bool(GROQ_API_KEY),
        "agents": ["news_sentiment", "technical_analysis", "quantitative_metrics", "orchestrator"]
    }
