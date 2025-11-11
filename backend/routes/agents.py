from fastapi import APIRouter
import requests
from config import GROQ_API_KEY

router = APIRouter()

@router.get("/groq")
def test_groq_llm():
    try:
        url = "https://api.groq.com/openai/v1/responses"
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "input": "Summarize the current crypto market in one sentence."
        }
        resp = requests.post(url, headers=headers, json=payload)
        data = resp.json()
        if resp.status_code == 200 and 'output' in data:
            output_text = data['output'][0]['content'][0]['text']
            return {"summary": output_text}
        return {"error": "Failed to fetch LLM response", "status": resp.status_code}
    except Exception as e:
        return {"error": str(e)}
