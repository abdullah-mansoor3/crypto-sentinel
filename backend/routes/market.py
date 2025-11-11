from fastapi import APIRouter
import requests
from config import CRYPTOPANIC_API_KEY

router = APIRouter()

@router.get("/cryptopanic")
def get_latest_crypto_news():
    try:
        url = f"https://cryptopanic.com/api/v1/posts/?auth_token={CRYPTOPANIC_API_KEY}&kind=news"
        resp = requests.get(url)
        data = resp.json()
        if resp.status_code == 200 and 'results' in data:
            return {"headline": data['results'][0]['title']}
        return {"error": "Failed to fetch news", "status": resp.status_code}
    except Exception as e:
        return {"error": str(e)}
