"""Uploaded answer sheets (photos and/or PDFs) -> one size-capped JPEG per page for the vision model."""
import io

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
MAX_PAGES_PER_SHEET = 20
_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
_MAX_DIMENSION = 1280
_JPEG_QUALITY = 90


class UnsupportedUpload(Exception):
    """Too large, too many pages, or not really an image/PDF. Callers turn this into a 422."""


def encode_page(image: Image.Image) -> bytes:
    """Any decoded page -> a size-capped JPEG. Decoding in full here is also the validation of an uploaded image."""
    if image.mode != "RGB":
        image = image.convert("RGB")
    if image.width > _MAX_DIMENSION or image.height > _MAX_DIMENSION:
        image.thumbnail((_MAX_DIMENSION, _MAX_DIMENSION))
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=_JPEG_QUALITY)
    return buf.getvalue()


def _is_pdf(name: str, content_type: str) -> bool:
    return content_type.endswith("pdf") or name.lower().endswith(".pdf")


def _is_image(name: str, content_type: str) -> bool:
    return content_type.lower() in _IMAGE_TYPES or name.lower().endswith(_IMAGE_EXTENSIONS)


def pages_from_bytes(files: list[tuple[str, str, bytes]]) -> list[bytes]:
    """files: (name, content_type, raw bytes) in reading order."""
    if len(files) > MAX_PAGES_PER_SHEET:
        raise UnsupportedUpload(f"Too many files: at most {MAX_PAGES_PER_SHEET} pages per answer sheet.")
    pages: list[bytes] = []
    for name, content_type, raw in files:
        label = name or "upload"
        if not raw:
            raise UnsupportedUpload(f"'{label}' is empty.")
        if len(raw) > MAX_FILE_SIZE_BYTES:
            raise UnsupportedUpload(f"'{label}' is too large: most {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB per file.")
        if _is_pdf(name, content_type):
            import pypdfium2 as pdfium

            try:
                pdf = pdfium.PdfDocument(raw)
                count = len(pdf)
            except Exception as exc:  # noqa: BLE001 - pdfium has no narrow exception type
                raise UnsupportedUpload(f"'{label}' isn't a readable PDF.") from exc
            if len(pages) + count > MAX_PAGES_PER_SHEET:
                raise UnsupportedUpload(f"Too many pages: at most {MAX_PAGES_PER_SHEET} pages per answer sheet.")
            for page in pdf:
                pages.append(encode_page(page.render(scale=200 / 72).to_pil()))
        elif _is_image(name, content_type):
            try:
                pages.append(encode_page(Image.open(io.BytesIO(raw))))
            except (UnidentifiedImageError, OSError) as exc:
                raise UnsupportedUpload(f"'{label}' isn't a readable image.") from exc
        else:
            raise UnsupportedUpload(f"'{label}' isn't a supported file type: only JPG, PNG, WEBP or PDF.")
    return pages


async def read_uploads(files: list[UploadFile]) -> list[tuple[str, str, bytes]]:
    out = []
    for f in files:
        if f.size is not None and f.size > MAX_FILE_SIZE_BYTES:
            raise UnsupportedUpload(f"'{f.filename or 'upload'}' is too large: most {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB per file.")
        out.append((f.filename or "", f.content_type or "", await f.read(MAX_FILE_SIZE_BYTES + 1)))
    return out
