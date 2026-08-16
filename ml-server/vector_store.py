import json
import os
import re
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from google import genai
from dotenv import load_dotenv

load_dotenv()

class OrdinanceVectorStore:
    """
    Pure Semantic Vector Store Microservice for IIIT Una Ordinances (IIITUGORD02).
    - Uses Google GenAI gemini-embedding-2 (3072-dim embeddings).
    - Performs true cosine similarity search across all ordinance documents.
    - Zero hardcoded keyword if-statements.
    """
    def __init__(
        self, 
        data_path: str = "data/iiit_una_ordinances.json",
        embeddings_path: str = "data/ordinance_embeddings.npy",
        embedding_model: str = "gemini-embedding-2"
    ):
        self.data_path = data_path
        self.embeddings_path = embeddings_path
        self.embedding_model = embedding_model
        self.documents: List[Dict[str, Any]] = []
        self.doc_embeddings: Optional[np.ndarray] = None
        self.client: Optional[genai.Client] = None
        
        self._init_client()
        self.load_documents()
        self.initialize_index()

    def _init_client(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            try:
                self.client = genai.Client(api_key=api_key)
            except Exception as e:
                print(f"Warning: Could not initialize Google GenAI Client: {e}")

    def load_documents(self):
        if os.path.exists(self.data_path):
            with open(self.data_path, "r", encoding="utf-8") as f:
                self.documents = json.load(f)
        else:
            print(f"Warning: {self.data_path} not found.")

    def _get_embedding(self, text: str) -> Optional[np.ndarray]:
        """Generates 3072-dimensional normalized dense embedding using gemini-embedding-2."""
        if not self.client:
            return None
        try:
            result = self.client.models.embed_content(
                model=self.embedding_model,
                contents=text
            )
            if result and result.embeddings and len(result.embeddings) > 0:
                values = result.embeddings[0].values
                vec = np.array(values, dtype=np.float32)
                # Cosine normalization
                norm = np.linalg.norm(vec)
                return vec / (norm + 1e-9)
        except Exception as e:
            print(f"Embedding generation error with {self.embedding_model}: {e}")
        return None

    def initialize_index(self):
        """Loads cached embeddings or computes fresh dense embeddings using Gemini API."""
        if not self.documents:
            return

        # 1. Try loading cached embeddings
        if os.path.exists(self.embeddings_path):
            try:
                cached = np.load(self.embeddings_path)
                if len(cached) == len(self.documents):
                    self.doc_embeddings = cached
                    print(f"Loaded {len(self.doc_embeddings)} cached ordinance embeddings from {self.embeddings_path}")
                    return
            except Exception as e:
                print(f"Error loading cached embeddings: {e}")

        # 2. Compute embeddings if client is available
        if self.client:
            print("Computing dense vector embeddings for all IIIT Una Ordinances via gemini-embedding-2...")
            vectors = []
            for doc in self.documents:
                text_to_embed = f"{doc.get('part', '')} - Section {doc.get('section', '')}: {doc.get('title', '')}\n\n{doc.get('text', '')}"
                vec = self._get_embedding(text_to_embed)
                if vec is not None:
                    vectors.append(vec)
                else:
                    break

            if len(vectors) == len(self.documents):
                self.doc_embeddings = np.array(vectors, dtype=np.float32)
                os.makedirs(os.path.dirname(self.embeddings_path), exist_ok=True)
                np.save(self.embeddings_path, self.doc_embeddings)
                print(f"Saved {len(self.doc_embeddings)} dense document embeddings to {self.embeddings_path}")
                return

        print("Notice: Dense embeddings not active. Operating in sparse fallback mode.")

    def _get_term_vector(self, text: str) -> Dict[str, float]:
        """Offline fallback term frequency vectorizer."""
        words = re.findall(r'\w+', text.lower())
        vec = {}
        for w in words:
            if len(w) > 2:
                vec[w] = vec.get(w, 0) + 1.0
        norm = np.sqrt(sum(v**2 for v in vec.values())) or 1.0
        return {k: v / norm for k, v in vec.items()}

    def search(self, query: str, top_k: int = 2, score_threshold: float = 0.45) -> List[Dict[str, Any]]:
        """
        Pure semantic vector search using cosine similarity.
        - Computes query embedding using gemini-embedding-2.
        - Computes dot product with normalized document embeddings.
        - Dynamically filters results by cosine similarity score.
        - Zero hardcoded keyword logic.
        """
        if not self.documents:
            return []

        # 1. Generate query embedding
        query_dense_vec = self._get_embedding(query)
        has_dense = (
            query_dense_vec is not None 
            and self.doc_embeddings is not None 
            and len(self.doc_embeddings) == len(self.documents)
        )

        if has_dense:
            # Pure dot product of unit vectors = exact cosine similarity
            similarity_scores = np.dot(self.doc_embeddings, query_dense_vec)
        else:
            # Offline TF fallback
            query_tf = self._get_term_vector(query)
            similarity_scores = []
            for doc in self.documents:
                doc_full = f"{doc.get('part', '')} {doc.get('section', '')} {doc.get('title', '')} {doc.get('text', '')}"
                doc_tf = self._get_term_vector(doc_full)
                score = sum(query_tf.get(k, 0) * doc_tf.get(k, 0) for k in query_tf)
                similarity_scores.append(score)
            similarity_scores = np.array(similarity_scores, dtype=np.float32)

        # Pair scores with documents
        scored_docs: List[Tuple[float, Dict[str, Any]]] = [
            (float(similarity_scores[i]), self.documents[i]) 
            for i in range(len(self.documents))
        ]

        # Sort strictly by semantic similarity score descending
        scored_docs.sort(key=lambda x: x[0], reverse=True)

        if not scored_docs:
            return []

        top_score = scored_docs[0][0]

        # Return top-scoring document, plus 2nd if it has strong relative similarity
        results = [scored_docs[0][1]]
        for score, doc in scored_docs[1:top_k]:
            if score >= max(score_threshold, top_score * 0.75):
                results.append(doc)

        return results

vector_store = OrdinanceVectorStore()
