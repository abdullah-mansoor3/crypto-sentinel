
import os
import requests
from dotenv import load_dotenv

# Load env
load_dotenv()

CRYPTOPANIC_API_KEY = os.getenv("CRYPTOPANIC_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# --- CryptoPanic test ---
try:
    cp_url = f"https://cryptopanic.com/api/v1/posts/?auth_token={CRYPTOPANIC_API_KEY}&kind=news"
    cp_resp = requests.get(cp_url)
    cp_data = cp_resp.json()
    if cp_resp.status_code == 200 and 'results' in cp_data:
        print("✅ CryptoPanic API works!")
        print("Latest headline:", cp_data['results'][0]['title'])
    else:
        print("❌ CryptoPanic API failed:", cp_resp.status_code, cp_resp.text)
except Exception as e:
    print("❌ CryptoPanic Test Error:", e)

# --- CoinGecko test (no key) ---
try:
    cg_url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd"
    cg_resp = requests.get(cg_url)
    cg_data = cg_resp.json()
    if cg_resp.status_code == 200:
        print("\n✅ CoinGecko API works!")
        print("BTC Price:", cg_data['bitcoin']['usd'], "USD")
        print("ETH Price:", cg_data['ethereum']['usd'], "USD")
    else:
        print("❌ CoinGecko API failed:", cg_resp.status_code, cg_resp.text)
except Exception as e:
    print("❌ CoinGecko Test Error:", e)

# --- Groq API test ---
try:
    groq_url = "https://api.groq.com/openai/v1/responses"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "input": "Summarize the current crypto market in one sentence."
    }
    groq_resp = requests.post(groq_url, headers=headers, json=payload)
    groq_data = groq_resp.json()
    if groq_resp.status_code == 200 and 'output' in groq_data:
        print("\n✅ Groq LLM API works!")
        print("LLM Response:", groq_data['output'][0]['type'] == "message" and groq_data['output'][0]['content'][0]['text'] or groq_data)
    else:
        print("❌ Groq API failed:", groq_resp.status_code, groq_resp.text)
except Exception as e:
    print("❌ Groq Test Error:", e)
