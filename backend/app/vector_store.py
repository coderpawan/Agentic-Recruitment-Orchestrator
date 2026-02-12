from __future__ import annotations

import chromadb
from chromadb.config import Settings
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from app.config import CHROMA_DIR, EMBEDDING_MODEL

# Singleton client / collection
_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None


def _get_embedding_fn() -> SentenceTransformerEmbeddingFunction:
    return SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL,
    )


def get_collection() -> chromadb.Collection:
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
        _collection = _client.get_or_create_collection(
            name="resumes",
            embedding_function=_get_embedding_fn(),
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _chunk_text(text: str, max_chars: int = 2000, overlap: int = 200) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + max_chars
        chunks.append(text[start:end])
        start += max_chars - overlap
    return chunks


def add_resume(resume_id: str, filename: str, text: str) -> int:
    col = get_collection()
    chunks = _chunk_text(text)
    ids = [f"{resume_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [
        {"resume_id": resume_id, "filename": filename, "chunk_index": i}
        for i in range(len(chunks))
    ]
    col.upsert(ids=ids, documents=chunks, metadatas=metadatas)
    return len(chunks)


def query_resumes(jd_text: str, top_n: int = 5) -> list[dict]:
    col = get_collection()
    # Query more chunks to ensure we get enough unique resumes
    results = col.query(
        query_texts=[jd_text],
        n_results=top_n * 5,
        include=["documents", "metadatas", "distances"],
    )

    seen: set[str] = set()
    ranked: list[dict] = []

    if not results["ids"] or not results["ids"][0]:
        return ranked

    for idx, doc_id in enumerate(results["ids"][0]):
        meta = results["metadatas"][0][idx]
        rid = meta["resume_id"]
        if rid in seen:
            continue
        seen.add(rid)
        ranked.append(
            {
                "resume_id": rid,
                "filename": meta["filename"],
                "score": 1 - results["distances"][0][idx],  # cosine → similarity
                "text": results["documents"][0][idx],
            }
        )
        if len(ranked) >= top_n:
            break

    return ranked


def get_full_resume_text(resume_id: str) -> str:
    col = get_collection()
    results = col.get(
        where={"resume_id": resume_id},
        include=["documents", "metadatas"],
    )
    if not results["ids"]:
        return ""

    # Sort by chunk_index and join
    pairs = sorted(
        zip(results["metadatas"], results["documents"]),
        key=lambda p: p[0].get("chunk_index", 0),
    )
    return " ".join(doc for _, doc in pairs)


def delete_resume(resume_id: str) -> None:
    col = get_collection()
    results = col.get(where={"resume_id": resume_id})
    if results["ids"]:
        col.delete(ids=results["ids"])


def reset_collection() -> None:
    global _client, _collection
    if _client is None:
        _client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
    # Drop the old collection if it exists
    try:
        _client.delete_collection("resumes")
    except Exception:
        pass
    # Recreate it fresh
    _collection = _client.get_or_create_collection(
        name="resumes",
        embedding_function=_get_embedding_fn(),
        metadata={"hnsw:space": "cosine"},
    )
