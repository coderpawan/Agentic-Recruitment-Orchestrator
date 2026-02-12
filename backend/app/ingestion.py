from __future__ import annotations

import shutil
from pathlib import Path
from typing import BinaryIO

import fitz  # PyMuPDF

from app.config import UPLOAD_DIR
from app.models import DocumentMeta


def extract_text_from_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages: list[str] = []
    for page in doc:
        pages.append(page.get_text("text"))
    doc.close()
    return "\n".join(pages).strip()


def extract_text_from_txt(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="replace").strip()


async def save_and_extract(
    file: BinaryIO,
    filename: str,
    doc_type: str,
) -> DocumentMeta:
    file_bytes = file if isinstance(file, bytes) else file.read()

    # Persist raw file
    dest = UPLOAD_DIR / filename
    dest.write_bytes(file_bytes)

    # Extract text based on extension
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        text = extract_text_from_pdf(file_bytes)
    elif suffix in (".txt", ".text", ".md"):
        text = extract_text_from_txt(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")

    if not text:
        raise ValueError(f"No text could be extracted from {filename}")

    meta = DocumentMeta(
        filename=filename,
        doc_type=doc_type,
        text=text,
    )
    return meta
