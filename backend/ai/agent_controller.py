"""
Main Orchestrator Agent for multi-agent crypto analysis pipeline.

This agent:
1. Runs a ReACT-style loop
2. Calls specialized sub-agents as tools
3. Aggregates their summaries
4. Produces the final comprehensive analysis
"""

import logging
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timezone
import json

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool, StructuredTool
from pydantic import BaseModel

from config import GROQ_API_KEY
from ai.schemas import (
    OrchestratorInput,
    OrchestratorOutput,
    AgentThought,
    NewsAgentInput,
    NewsAgentOutput,
    TechnicalAgentInput,
    TechnicalAgentOutput,
    QuantAgentInput,
    QuantAgentOutput,
    ProgressUpdate,
)
from ai.sub_agents import (
    run_news_agent,
    run_technical_agent,
    run_quant_agent,
    ProgressCallback,
    make_progress,
)

logger = logging.getLogger("crypto-sentinel.orchestrator")


# =============================================================================
# ORCHESTRATOR SYSTEM PROMPT
# =============================================================================

ORCHESTRATOR_SYSTEM_PROMPT = """You are the Master Orchestrator Agent for crypto analysis.
You coordinate specialized agents to provide comprehensive market analysis.

Your role is to:
1. Call the appropriate sub-agents based on the user's request
2. Synthesize their findings into a unified analysis
3. Provide a clear recommendation with confidence level

Available agents:
- News Sentiment Agent: Analyzes recent news and market sentiment
- Technical Analysis Agent: Analyzes price patterns and technical indicators
- Quantitative Metrics Agent: Analyzes risk metrics and returns

Guidelines:
- Be objective and balanced in your final analysis
- Acknowledge uncertainty when signals conflict
- Never make price predictions - focus on risk/reward assessment
- Clearly explain your reasoning
- Provide actionable insights

Recommendation scale:
- strong_buy: Multiple strong bullish signals, favorable risk/reward
- buy: Bullish signals outweigh bearish, acceptable risk
- hold: Mixed signals or insufficient data, maintain position
- sell: Bearish signals outweigh bullish, elevated risk
- strong_sell: Multiple strong bearish signals, unfavorable risk/reward
"""


# =============================================================================
# ORCHESTRATOR AGENT
# =============================================================================

class OrchestratorAgent:
    """
    Main orchestrator that runs a ReACT-style loop,
    calling sub-agents as tools and aggregating results.
    """
    
    def __init__(self, progress_callback: Optional[ProgressCallback] = None):
        self.progress_callback = progress_callback
        self.llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=GROQ_API_KEY,
            temperature=0.2,
            max_tokens=4096,
        )
        self.thought_process: List[AgentThought] = []
    
    def _add_thought(self, thought: str):
        """Record a thought in the reasoning trace."""
        agent_thought = AgentThought(
            agent="Orchestrator",
            thought=thought,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        self.thought_process.append(agent_thought)
        make_progress(
            "thinking",
            "Orchestrator",
            thought,
            callback=self.progress_callback
        )
    
    def run(self, input_data: OrchestratorInput) -> OrchestratorOutput:
        """
        Run the orchestrator agent.
        
        This implements a simplified ReACT pattern:
        1. Plan: Determine which agents to call
        2. Act: Call each sub-agent
        3. Observe: Collect and validate results
        4. Reflect: Synthesize findings
        5. Respond: Generate final analysis
        """
        self.thought_process = []
        
        try:
            # Phase 1: Planning
            self._add_thought(f"Starting analysis for {input_data.coin}")
            self._add_thought("Planning analysis pipeline based on configuration...")
            
            agents_to_run = []
            if input_data.include_news:
                agents_to_run.append("news")
            if input_data.include_technical:
                agents_to_run.append("technical")
            if input_data.include_quant:
                agents_to_run.append("quant")
            
            self._add_thought(f"Will run {len(agents_to_run)} sub-agents: {', '.join(agents_to_run)}")
            
            # Phase 2: Execute sub-agents
            news_result: Optional[NewsAgentOutput] = None
            technical_result: Optional[TechnicalAgentOutput] = None
            quant_result: Optional[QuantAgentOutput] = None
            
            # Run News Agent
            if input_data.include_news:
                self._add_thought("Calling News Sentiment Agent...")
                make_progress(
                    "tool_call",
                    "Orchestrator",
                    "Invoking News Sentiment Agent",
                    {"agent": "news"},
                    self.progress_callback
                )
                
                news_input = NewsAgentInput(coin=input_data.coin)
                news_result = run_news_agent(news_input, self.progress_callback)
                
                self._add_thought(f"News analysis complete: {news_result.overall_sentiment} sentiment")
                
                # Record sub-agent thoughts
                self.thought_process.append(AgentThought(
                    agent="News Sentiment Agent",
                    thought=f"Overall sentiment: {news_result.overall_sentiment}, Score: {news_result.avg_sentiment_score:.2f}",
                    timestamp=datetime.now(timezone.utc).isoformat()
                ))
            
            # Run Technical Agent
            if input_data.include_technical:
                self._add_thought("Calling Technical Analysis Agent...")
                make_progress(
                    "tool_call",
                    "Orchestrator",
                    "Invoking Technical Analysis Agent",
                    {"agent": "technical"},
                    self.progress_callback
                )
                
                technical_input = TechnicalAgentInput(coin=input_data.coin, days=input_data.days)
                technical_result = run_technical_agent(technical_input, self.progress_callback)
                
                self._add_thought(f"Technical analysis complete: {technical_result.overall_trend} trend")
                
                self.thought_process.append(AgentThought(
                    agent="Technical Analysis Agent",
                    thought=f"Overall trend: {technical_result.overall_trend}, Price: ${technical_result.current_price:,.2f}",
                    timestamp=datetime.now(timezone.utc).isoformat()
                ))
            
            # Run Quant Agent
            if input_data.include_quant:
                self._add_thought("Calling Quantitative Metrics Agent...")
                make_progress(
                    "tool_call",
                    "Orchestrator",
                    "Invoking Quantitative Metrics Agent",
                    {"agent": "quant"},
                    self.progress_callback
                )
                
                quant_input = QuantAgentInput(coin=input_data.coin, days=input_data.days)
                quant_result = run_quant_agent(quant_input, self.progress_callback)
                
                self._add_thought(f"Quant analysis complete: {quant_result.risk_level} risk")
                
                self.thought_process.append(AgentThought(
                    agent="Quantitative Metrics Agent",
                    thought=f"Risk level: {quant_result.risk_level}, Sharpe: {quant_result.risk_metrics.sharpe_ratio:.2f}",
                    timestamp=datetime.now(timezone.utc).isoformat()
                ))
            
            # Phase 3: Synthesize results
            self._add_thought("Synthesizing results from all agents...")
            make_progress(
                "thinking",
                "Orchestrator",
                "Generating final analysis...",
                callback=self.progress_callback
            )
            
            final_output = self._synthesize_analysis(
                input_data,
                news_result,
                technical_result,
                quant_result
            )
            
            make_progress(
                "final",
                "Orchestrator",
                "Analysis complete",
                {"recommendation": final_output.recommendation, "confidence": final_output.confidence},
                self.progress_callback
            )
            
            return final_output
            
        except Exception as e:
            logger.exception("Orchestrator error")
            make_progress(
                "error",
                "Orchestrator",
                f"Error: {str(e)}",
                callback=self.progress_callback
            )
            
            # Return error output
            return OrchestratorOutput(
                final_analysis=f"Error during analysis: {str(e)}",
                recommendation="hold",
                confidence=0.0,
                risk_level="moderate",
                news_analysis=None,
                technical_analysis=None,
                quant_analysis=None,
                thought_process=self.thought_process,
                coin=input_data.coin,
                analysis_timestamp=datetime.now(timezone.utc).isoformat()
            )
    
    def _synthesize_analysis(
        self,
        input_data: OrchestratorInput,
        news_result: Optional[NewsAgentOutput],
        technical_result: Optional[TechnicalAgentOutput],
        quant_result: Optional[QuantAgentOutput]
    ) -> OrchestratorOutput:
        """
        Use LLM to synthesize all agent results into a final analysis.
        """
        # Build context for LLM
        context_parts = []
        
        if news_result:
            context_parts.append(f"""
NEWS SENTIMENT ANALYSIS:
- Overall Sentiment: {news_result.overall_sentiment}
- Sentiment Score: {news_result.avg_sentiment_score:.2f}
- Articles Analyzed: {news_result.news_count}
- Summary: {news_result.sentiment_summary}
Top Events:
{chr(10).join([f'  - {e.title} ({e.sentiment}, {e.sentiment_score:.2f})' for e in news_result.top_events[:3]])}
""")
        
        if technical_result:
            signals_text = "\n".join([
                f"  - {s.indicator}: {s.signal.upper()} ({s.description})"
                for s in technical_result.indicator_signals
            ])
            context_parts.append(f"""
TECHNICAL ANALYSIS:
- Overall Trend: {technical_result.overall_trend}
- Current Price: ${technical_result.current_price:,.2f}
- Price Change: {technical_result.price_change_pct:+.2f}%
- Summary: {technical_result.trend_summary}
Indicator Signals:
{signals_text}
Key Levels:
{chr(10).join([f'  - {l.level_type.title()}: ${l.price:,.2f} ({l.strength})' for l in technical_result.key_levels])}
""")
        
        if quant_result:
            context_parts.append(f"""
QUANTITATIVE ANALYSIS:
- Risk Level: {quant_result.risk_level}
- Summary: {quant_result.risk_summary}
Return Metrics:
  - Total Return: {quant_result.return_metrics.total_return:+.2f}%
  - Annualized Return: {quant_result.return_metrics.annualized_return:+.2f}%
  - Best Day: {quant_result.return_metrics.best_day:+.2f}%
  - Worst Day: {quant_result.return_metrics.worst_day:+.2f}%
Risk Metrics:
  - Volatility: {quant_result.risk_metrics.volatility:.2f}%
  - Sharpe Ratio: {quant_result.risk_metrics.sharpe_ratio:.2f}
  - Sortino Ratio: {quant_result.risk_metrics.sortino_ratio:.2f}
  - Max Drawdown: {quant_result.risk_metrics.max_drawdown:.2f}%
  - VaR (95%): {quant_result.risk_metrics.var_95:.2f}%
Risk/Reward Assessment: {quant_result.risk_reward_assessment}
""")
        
        full_context = "\n".join(context_parts)
        
        synthesis_prompt = f"""Based on the following analysis from specialized agents, provide a comprehensive final analysis for {input_data.coin}.

{full_context}

Respond with ONLY valid JSON matching this exact structure (no markdown, no extra text):
{{
    "final_analysis": "Your comprehensive 3-5 paragraph analysis here. Synthesize all findings.",
    "recommendation": "buy",
    "confidence": 0.75,
    "risk_level": "moderate"
}}

Rules:
- final_analysis: 3-5 paragraphs synthesizing all findings. Use \\n for newlines.
- recommendation: MUST be one of: "strong_buy", "buy", "hold", "sell", "strong_sell"
- confidence: Float between 0.0 and 1.0
- risk_level: MUST be one of: "low", "moderate", "high", "extreme"

Be objective, acknowledge uncertainty where signals conflict, and focus on risk/reward assessment.
Do NOT make specific price predictions. Return ONLY the JSON object."""

        response = self.llm.invoke([
            SystemMessage(content=ORCHESTRATOR_SYSTEM_PROMPT),
            HumanMessage(content=synthesis_prompt)
        ])
        
        # Parse LLM JSON response with Pydantic validation
        response_text = response.content.strip()
        
        # Default values in case parsing fails
        final_analysis = ""
        recommendation = "hold"
        confidence = 0.5
        risk_level = "moderate"
        
        try:
            # Clean up response - remove markdown code blocks if present
            cleaned_response = response_text
            if cleaned_response.startswith("```"):
                # Remove ```json or ``` at start and ``` at end
                lines = cleaned_response.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]  # Remove first line
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]  # Remove last line
                cleaned_response = "\n".join(lines)
            
            # Parse JSON
            parsed = json.loads(cleaned_response)
            
            # Validate with Pydantic model
            class SynthesisResponse(BaseModel):
                final_analysis: str
                recommendation: str
                confidence: float
                risk_level: str
            
            validated = SynthesisResponse(**parsed)
            
            # Extract validated values
            final_analysis = validated.final_analysis
            
            # Validate recommendation enum
            if validated.recommendation.lower().replace(" ", "_") in ["strong_buy", "buy", "hold", "sell", "strong_sell"]:
                recommendation = validated.recommendation.lower().replace(" ", "_")
            
            # Clamp confidence to valid range
            confidence = max(0.0, min(1.0, validated.confidence))
            
            # Validate risk_level enum
            if validated.risk_level.lower() in ["low", "moderate", "high", "extreme"]:
                risk_level = validated.risk_level.lower()
            
            logger.info(f"Successfully parsed LLM JSON response: recommendation={recommendation}, confidence={confidence}")
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse LLM response as JSON: {e}")
            logger.debug(f"Raw response: {response_text[:500]}")
            # Fallback: use the raw response as final_analysis
            final_analysis = response_text
            
        except Exception as e:
            logger.warning(f"Failed to validate LLM response: {e}")
            final_analysis = response_text
        
        # If no explicit risk level parsed, derive from quant results
        if quant_result and risk_level == "moderate":
            risk_level = quant_result.risk_level
        
        self._add_thought(f"Final recommendation: {recommendation} (confidence: {confidence:.0%})")
        
        return OrchestratorOutput(
            final_analysis=final_analysis,
            recommendation=recommendation,
            confidence=confidence,
            risk_level=risk_level,
            news_analysis=news_result,
            technical_analysis=technical_result,
            quant_analysis=quant_result,
            thought_process=self.thought_process,
            coin=input_data.coin,
            analysis_timestamp=datetime.now(timezone.utc).isoformat()
        )


# =============================================================================
# CONVENIENCE FUNCTION
# =============================================================================

def run_orchestrator(
    coin: str,
    days: int = 30,
    include_news: bool = True,
    include_technical: bool = True,
    include_quant: bool = True,
    progress_callback: Optional[ProgressCallback] = None
) -> OrchestratorOutput:
    """
    Convenience function to run the orchestrator agent.
    """
    input_data = OrchestratorInput(
        coin=coin,
        days=days,
        include_news=include_news,
        include_technical=include_technical,
        include_quant=include_quant
    )
    
    agent = OrchestratorAgent(progress_callback=progress_callback)
    return agent.run(input_data)
