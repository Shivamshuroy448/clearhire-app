import sys
import os

# Ensure api directory is in sys.path for relative imports on AWS Lambda / Vercel
api_dir = os.path.dirname(__file__)
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from main import app
