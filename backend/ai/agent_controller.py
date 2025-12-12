"""
Main Orchestrator Agent for multi-agent crypto analysis pipeline.

This agent:
1. Runs a true ReACT-style loop
2. Dynamically chooses which agents to call based on LLM reasoning
3. Receives observations from agent calls
4. Continues looping until all needed analysis is done
5. Aggregates results and produces final analysis
"""

import logging
from typing import Dict, Any, Optional, List, Callable, Literal
from datetime import datetime, timezone
import json
import re

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
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
# ORCHESTRATOR SYSTEM PROMPT FOR ReACT LOOP
# =============================================================================

ORCHESTRATOR_SYSTEM_PROMPT = """You are the Master Orchestrator Agent for cryptocurrency analysis.
You have access to specialized agents and must use a ReACT-style loop to analyze crypto markets.

## Your Role
1. Use Thought-Action-Observation loops to coordinate analysis
2. Decide which agents to call based on what analysis is needed
3. Synthesize findings into a comprehensive recommendation

## Available Agents (Tools)
- news_sentiment: Analyzes news sentiment and market sentiment
- technical_analysis: Analyzes price patterns and technical indicators
- quantitative_metrics: Analyzes risk metrics, volatility, and returns

## Agent Status Tracking
Keep track of which agents have been called:
- News Sentiment Agent: Provides market sentiment, news impact, overall bullish/bearish/neutral stance
- Technical Analysis Agent: Provides trend analysis, indicator signals, support/resistance levels
- Quantitative Metrics Agent: Provides risk assessment, Sharpe ratio, Sortino ratio, VaR, drawdowns

## ReACT Loop Format
Use the following format for each loop iteration:

Thought: [Explain what analysis is needed, what you've learned so far, and which agent to call next]
Action: [Agent name you are calling]
Observation: [The result from the agent call - you will receive this]

## When to Stop Looping
Call the STOP action when:
- All required agents have been executed (news, technical, quant)
- You have enough information to synthesize a recommendation
- You're ready to generate the final analysis

## Guidelines
- Always be systematic in your analysis
- Call all available agents for comprehensive analysis
- Start with news sentiment, then technical, then quant
- Use observations to inform subsequent analysis
- Never make price predictions; focus on risk/reward assessment
- Be objective and acknowledge uncertainty
- When stopping, summarize what you learned from each agent

## Recommendation Criteria
- strong_buy: Multiple bullish signals, excellent risk/reward, sentiment positive
- buy: Bullish bias, acceptable risk, mixed to positive signals
- hold: Mixed signals, unclear direction, need more data
- sell: Bearish bias, elevated risk, negative signals
- strong_sell: Multiple bearish signals, poor risk/reward, negative sentiment
"""


# =============================================================================
# AGENT TOOLS DEFINITIONS
# =============================================================================

class AgentToolCall(BaseModel):
    """Represents a tool call to an agent."""
    agent: Literal["news_sentiment", "technical_analysis", "quantitative_metrics"]
    parameters: Dict[str, Any]


def create_agent_tools():
    """Create tool wrappers for sub-agents."""
    
    @tool
    def news_sentiment(coin: str) -> str:
        """
        Call the News Sentiment Agent to analyze market sentiment from news articles.
        
        Args:
            coin: Cryptocurrency symbol (e.g., 'BTC', 'ETH')
        
        Returns:
            JSON string with sentiment analysis results
        """
        try:
            news_input = NewsAgentInput(coin=coin)
            result = run_news_agent(news_input, progress_callback=None)
            return json.dumps({
                "status": "success",
                "overall_sentiment": result.overall_sentiment,
                "avg_sentiment_score": result.avg_sentiment_score,
                "summary": result.sentiment_summary,
                "articles_analyzed": result.news_count,
                "top_events": [
                    {
                        "title": e.title,
                        "sentiment": e.sentiment,
                        "score": e.sentiment_score
                    }
                    for e in result.top_events[:3]
                ]
            })
        except Exception as e:
            return json.dumps({"status": "error", "message": str(e)})
    
    @tool
    def technical_analysis(coin: str, days: int = 30) -> str:
        """
        Call the Technical Analysis Agent to analyze price patterns and indicators.
        
        Args:
            coin: Cryptocurrency symbol (e.g., 'BTC', 'ETH')
            days: Number of days for analysis (default: 30)
        
        Returns:
            JSON string with technical analysis results
        """
        try:
            tech_input = TechnicalAgentInput(coin=coin, days=days)
            result = run_technical_agent(tech_input, progress_callback=None)
            return json.dumps({
                "status": "success",
                "overall_trend": result.overall_trend,
                "current_price": result.current_price,
                "price_change_pct": result.price_change_pct,
                "summary": result.trend_summary,
                "signals": [
                    {
                        "indicator": s.indicator,
                        "value": s.value,
                        "signal": s.signal,
                        "description": s.description
                    }
                    for s in result.indicator_signals
                ],
                "key_levels": [
                    {
                        "type": l.level_type,
                        "price": l.price,
                        "strength": l.strength
                    }
                    for l in result.key_levels
                ]
            })
        except Exception as e:
            return json.dumps({"status": "error", "message": str(e)})
    
    @tool
    def quantitative_metrics(coin: str, days: int = 30) -> str:
        """
        Call the Quantitative Metrics Agent to analyze risk and return metrics.
        
        Args:
            coin: Cryptocurrency symbol (e.g., 'BTC', 'ETH')
            days: Number of days for analysis (default: 30)
        
        Returns:
            JSON string with quantitative analysis results
        """
        try:
            quant_input = QuantAgentInput(coin=coin, days=days)
            result = run_quant_agent(quant_input, progress_callback=None)
            return json.dumps({
                "status": "success",
                "risk_level": result.risk_level,
                "summary": result.risk_summary,
                "returns": {
                    "total": result.return_metrics.total_return,
                    "annualized": result.return_metrics.annualized_return,
                    "daily_avg": result.return_metrics.daily_avg_return,
                    "best_day": result.return_metrics.best_day,
                    "worst_day": result.return_metrics.worst_day
                },
                "risk_metrics": {
                    "volatility": result.risk_metrics.volatility,
                    "sharpe_ratio": result.risk_metrics.sharpe_ratio,
                    "sortino_ratio": result.risk_metrics.sortino_ratio,
                    "max_drawdown": result.risk_metrics.max_drawdown,
                    "var_95": result.risk_metrics.var_95,
                    "cvar_95": result.risk_metrics.cvar_95
                },
                "risk_reward_assessment": result.risk_reward_assessment
            })
        except Exception as e:
            return json.dumps({"status": "error", "message": str(e)})
    
    return [news_sentiment, technical_analysis, quantitative_metrics]


# =============================================================================
# ORCHESTRATOR AGENT CLASS
# =============================================================================

class OrchestratorAgent:
    """
    Main orchestrator that runs a true ReACT-style loop,
    dynamically choosing which agents to call based on reasoning.
    """
    
    def __init__(self, progress_callback: Optional[ProgressCallback] = None):
        self.progress_callback = progress_callback
        self.llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=GROQ_API_KEY,
            temperature=0.3,  # Slightly higher for reasoning
            max_tokens=4096,
        )
        self.thought_process: List[AgentThought] = []
        self.agent_results: Dict[str, Any] = {}  # Store results from each agent
        self.tools = create_agent_tools()
    
    def _add_thought(self, thought: str, agent: str = "Orchestrator"):
        """Record a thought in the reasoning trace and broadcast to frontend."""
        agent_thought = AgentThought(
            agent=agent,
            thought=thought,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        self.thought_process.append(agent_thought)
        make_progress(
            "thinking",
            agent,
            thought,
            callback=self.progress_callback
        )
    
    def _broadcast_action(self, action: str):
        """Broadcast action to frontend."""
        make_progress(
            "tool_call",
            "Orchestrator",
            f"Calling {action}...",
            {"agent": action},
            self.progress_callback
        )
    
    def run(self, input_data: OrchestratorInput) -> OrchestratorOutput:
        """
        Run the orchestrator agent with a true ReACT loop.
        
        The loop:
        1. LLM thinks about what to do next
        2. LLM decides which agent to call
        3. Agent is executed
        4. Result is fed back as observation
        5. Loop continues until STOP is called
        """
        self.thought_process = []
        self.agent_results = {}
        
        try:
            self._add_thought(
                f"Starting comprehensive analysis for {input_data.coin} with {input_data.days} days of data"
            )
            
            # Initialize message history for ReACT loop
            messages: List[BaseMessage] = [
                SystemMessage(content=ORCHESTRATOR_SYSTEM_PROMPT)
            ]
            
            # Initial prompt with available agents and what to analyze
            initial_prompt = f"""Analyze {input_data.coin} and provide a comprehensive investment analysis.

Available analysis modes:
- News Sentiment: {input_data.include_news}
- Technical Analysis: {input_data.include_technical}
- Quantitative Metrics: {input_data.include_quant}

Use the ReACT loop to analyze the cryptocurrency. Call all available agents in a logical order.
Format each step as:
Thought: [your reasoning]
Action: [agent name]

Agent names: news_sentiment, technical_analysis, quantitative_metrics
When done, use: Action: STOP"""
            
            messages.append(HumanMessage(content=initial_prompt))
            
            # ReACT Loop
            max_iterations = 10  # Prevent infinite loops
            iteration = 0
            
            while iteration < max_iterations:
                iteration += 1
                self._add_thought(f"ReACT Loop iteration {iteration}")
                
                # Get LLM response
                response = self.llm.invoke(messages)
                response_text = response.content.strip()
                
                self._add_thought(f"LLM reasoning:\n{response_text}", agent="Orchestrator-ReACT")
                
                # Add LLM response to message history
                messages.append(AIMessage(content=response_text))
                
                # Parse action from response
                action_match = re.search(r"Action:\s*([^\n]+)", response_text, re.IGNORECASE)
                
                if not action_match:
                    self._add_thought("Could not parse action from LLM response, stopping loop")
                    break
                
                action = action_match.group(1).strip().lower()
                
                # Check for STOP
                if "stop" in action:
                    self._add_thought("All analysis complete, synthesizing final recommendation")
                    break
                
                # Execute agent based on action
                observation = None
                
                if action == "news_sentiment":
                    if not input_data.include_news:
                        observation = json.dumps({"status": "skipped", "reason": "News analysis disabled"})
                    elif "news_sentiment" not in self.agent_results:
                        self._broadcast_action("News Sentiment Agent")
                        observation = self.tools[0].invoke({"coin": input_data.coin})
                        self.agent_results["news_sentiment"] = json.loads(observation)
                        self._add_thought(f"News Sentiment Agent executed")
                    else:
                        observation = json.dumps({"status": "already_executed", "reason": "Already called this agent"})
                
                elif action == "technical_analysis":
                    if not input_data.include_technical:
                        observation = json.dumps({"status": "skipped", "reason": "Technical analysis disabled"})
                    elif "technical_analysis" not in self.agent_results:
                        self._broadcast_action("Technical Analysis Agent")
                        observation = self.tools[1].invoke({"coin": input_data.coin, "days": input_data.days})
                        self.agent_results["technical_analysis"] = json.loads(observation)
                        self._add_thought(f"Technical Analysis Agent executed")
                    else:
                        observation = json.dumps({"status": "already_executed", "reason": "Already called this agent"})
                
                elif action == "quantitative_metrics":
                    if not input_data.include_quant:
                        observation = json.dumps({"status": "skipped", "reason": "Quantitative analysis disabled"})
                    elif "quantitative_metrics" not in self.agent_results:
                        self._broadcast_action("Quantitative Metrics Agent")
                        observation = self.tools[2].invoke({"coin": input_data.coin, "days": input_data.days})
                        self.agent_results["quantitative_metrics"] = json.loads(observation)
                        self._add_thought(f"Quantitative Metrics Agent executed")
                    else:
                        observation = json.dumps({"status": "already_executed", "reason": "Already called this agent"})
                
                else:
                    observation = json.dumps({"status": "error", "message": f"Unknown agent: {action}"})
                
                # Add observation to message history
                if observation:
                    messages.append(HumanMessage(content=f"Observation: {observation}"))
            
            # After ReACT loop: convert stored results to agent output objects
            news_result = None
            technical_result = None
            quant_result = None
            
            # Reconstruct typed outputs from stored results
            if "news_sentiment" in self.agent_results and self.agent_results["news_sentiment"].get("status") == "success":
                try:
                    raw = self.agent_results["news_sentiment"]
                    # Call agent again to get typed output (simpler than reconstructing)
                    news_input = NewsAgentInput(coin=input_data.coin)
                    news_result = run_news_agent(news_input, self.progress_callback)
                except:
                    pass
            
            if "technical_analysis" in self.agent_results and self.agent_results["technical_analysis"].get("status") == "success":
                try:
                    tech_input = TechnicalAgentInput(coin=input_data.coin, days=input_data.days)
                    technical_result = run_technical_agent(tech_input, self.progress_callback)
                except:
                    pass
            
            if "quantitative_metrics" in self.agent_results and self.agent_results["quantitative_metrics"].get("status") == "success":
                try:
                    quant_input = QuantAgentInput(coin=input_data.coin, days=input_data.days)
                    quant_result = run_quant_agent(quant_input, self.progress_callback)
                except:
                    pass
            
            # Synthesize final analysis
            self._add_thought("Synthesizing all findings into final recommendation")
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
            self._add_thought(f"Error occurred: {str(e)}")
            make_progress(
                "error",
                "Orchestrator",
                f"Error: {str(e)}",
                callback=self.progress_callback
            )
            
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
