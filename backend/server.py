import uvicorn
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CMS.settings')

from django.core.asgi import get_asgi_application
app = get_asgi_application()

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
