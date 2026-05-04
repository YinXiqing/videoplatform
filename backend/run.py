import os
import uvicorn
from app.logger import setup_logging

setup_logging()

from app import create_app

app = create_app()

if __name__ == "__main__":
    uvicorn.run("run:app", host="0.0.0.0", port=5000, workers=int(os.environ.get("WORKERS", 1)))
