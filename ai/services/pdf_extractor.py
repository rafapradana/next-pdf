"""
PDF Text Extraction Service
Extracts text content from PDF files using PyMuPDF
"""

import fitz  # PyMuPDF
from io import BytesIO
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class PDFExtractor:
    """Handles PDF text extraction"""
    
    @staticmethod
    def extract_text(pdf_bytes: bytes) -> str:
        """
        Extract text from PDF bytes
        
        Args:
            pdf_bytes: Raw PDF file content
            
        Returns:
            Extracted text from all pages
        """
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text_parts = []
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text = page.get_text("text")
                if text.strip():
                    text_parts.append(f"--- Page {page_num + 1} ---\n{text}")
            
            doc.close()
            
            full_text = "\n\n".join(text_parts)
            logger.info(f"Extracted {len(full_text)} characters from {len(text_parts)} pages")
            
            return full_text
            
        except Exception as e:
            logger.error(f"Failed to extract text from PDF: {e}")
            raise ValueError(f"Failed to extract text from PDF: {str(e)}")
    
    @staticmethod
    def get_page_count(pdf_bytes: bytes) -> int:
        """
        Get the number of pages in a PDF
        
        Args:
            pdf_bytes: Raw PDF file content
            
        Returns:
            Number of pages
        """
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page_count = len(doc)
            doc.close()
            return page_count
        except Exception as e:
            logger.error(f"Failed to get page count: {e}")
            return 0
    
    @staticmethod
    def extract_metadata(pdf_bytes: bytes) -> dict:
        """
        Extract metadata from PDF
        
        Args:
            pdf_bytes: Raw PDF file content
            
        Returns:
            Dictionary containing PDF metadata
        """
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            metadata = doc.metadata
            page_count = len(doc)
            doc.close()
            
            return {
                "title": metadata.get("title", ""),
                "author": metadata.get("author", ""),
                "subject": metadata.get("subject", ""),
                "creator": metadata.get("creator", ""),
                "page_count": page_count,
            }
        except Exception as e:
            logger.error(f"Failed to extract metadata: {e}")
            return {"page_count": 0}
