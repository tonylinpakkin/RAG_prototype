#!/usr/bin/env python3
import sys
import json
import numpy as np
from sentence_transformers import SentenceTransformer

def main():
    try:
        # Read input from stdin
        input_text = sys.stdin.read()
        texts = json.loads(input_text)
        
        # Load a lightweight multilingual model
        model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Generate embeddings
        embeddings = model.encode(texts)
        
        # Convert to list for JSON serialization
        embeddings_list = embeddings.tolist()
        
        # Output as JSON
        print(json.dumps(embeddings_list))
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
