from fastapi import APIRouter
import requests

router = APIRouter()

@router.get("/prices")
def get_crypto_prices():
    try:
        url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd"
        resp = requests.get(url)
        data = resp.json()
        if resp.status_code == 200:
            return {
                "BTC": data['bitcoin']['usd'],
                "ETH": data['ethereum']['usd']
            }
        return {"error": "Failed to fetch prices", "status": resp.status_code}
    except Exception as e:
        return {"error": str(e)}
