"""
NEXT PDF AI Service
FastAPI application for PDF summarization using Google Gemini
"""

import logging
import time
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from minio import Minio

from config import get_settings
from services import PDFExtractor, Summarizer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Pydantic models
class SummarizeRequest(BaseModel):
    """Request model for summary generation"""
    file_id: str = Field(..., description="UUID of the file to summarize")
    storage_path: str = Field(..., description="Path to file in MinIO storage")
    style: str = Field(default="bullet_points", description="Summary style")
    custom_instructions: Optional[str] = Field(None, max_length=500)
    language: str = Field(default="en", description="Summary language: 'en' or 'id'")
    callback_url: Optional[str] = Field(None, description="URL to callback when complete")


class SummarizeResponse(BaseModel):
    """Response model for summary generation"""
    file_id: str
    status: str
    message: str


class SummaryResult(BaseModel):
    """Result model sent to callback"""
    file_id: str
    title: str
    content: str
    style: str
    custom_instructions: Optional[str]
    model_used: str = "gemini-2.5-flash"
    prompt_tokens: int
    completion_tokens: int
    processing_duration_ms: int
    language: str = "en"
    status: str  # "completed" or "failed"
    error_message: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: str
    version: str = "1.0.0"


class GuestSummaryResponse(BaseModel):
    """Response model for guest synchronous summarization"""
    title: str
    content: str
    style: str
    language: str
    processing_duration_ms: int
    model_used: str = "gemini-2.5-flash"


# Initialize services
settings = get_settings()
pdf_extractor = PDFExtractor()
summarizer = Summarizer()

# Initialize MinIO client
minio_client = None
try:
    minio_client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_use_ssl
    )
    logger.info(f"MinIO client initialized: {settings.minio_endpoint}")
except Exception as e:
    logger.error(f"Failed to initialize MinIO client: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    logger.info("AI Service starting up...")
    yield
    logger.info("AI Service shutting down...")


# Create FastAPI app
app = FastAPI(
    title="NEXT PDF AI Service",
    description="PDF summarization service using Google Gemini",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat()
    )


@app.get("/styles")
async def get_styles():
    """Get available summary styles"""
    return {"data": Summarizer.get_available_styles()}


@app.post("/summarize-sync", response_model=GuestSummaryResponse)
async def summarize_sync(
    file: UploadFile = File(..., description="PDF file to summarize"),
    style: str = Form(default="bullet_points", description="Summary style"),
    language: str = Form(default="en", description="Summary language: 'en' or 'id'"),
    custom_instructions: Optional[str] = Form(default=None, max_length=500)
):
    """
    Synchronous PDF summarization for guest users.
    
    Receives PDF directly as multipart upload, processes immediately,
    and returns the summary in the response. No storage involved.
    """
    start_time = time.time()
    
    # Validate file type
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    if file.content_type and file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Must be PDF")
    
    # Validate style
    valid_styles = ["bullet_points", "paragraph", "detailed", "executive", "academic"]
    if style not in valid_styles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid style. Must be one of: {', '.join(valid_styles)}"
        )
    
    # Validate language
    if language not in ["en", "id"]:
        raise HTTPException(status_code=400, detail="Language must be 'en' or 'id'")
    
    try:
        # Read PDF bytes directly from upload
        pdf_bytes = await file.read()
        
        # Check file size (10MB limit for guests)
        if len(pdf_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        
        logger.info(f"Guest summarization: {len(pdf_bytes)} bytes, style={style}, lang={language}")
        
        # Extract text from PDF
        text = pdf_extractor.extract_text(pdf_bytes)
        if not text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF")
        
        logger.info(f"Extracted text: {len(text)} characters")
        
        # Generate summary
        title, content, prompt_tokens, completion_tokens = summarizer.generate_summary(
            text=text,
            style=style,
            custom_instructions=custom_instructions,
            language=language
        )
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        logger.info(f"Guest summary generated in {processing_time_ms}ms")
        
        return GuestSummaryResponse(
            title=title,
            content=content,
            style=style,
            language=language,
            processing_duration_ms=processing_time_ms
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Guest summarization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")


@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest, background_tasks: BackgroundTasks):
    """
    Queue a PDF for summarization
    
    The actual processing happens in the background.
    Results are sent to the callback URL when complete.
    """
    # Validate style
    valid_styles = ["bullet_points", "paragraph", "detailed", "executive", "academic"]
    if request.style not in valid_styles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid style. Must be one of: {', '.join(valid_styles)}"
        )
    
    # Add to background processing
    background_tasks.add_task(
        process_summary,
        request.file_id,
        request.storage_path,
        request.style,
        request.custom_instructions,
        request.language,
        request.callback_url
    )
    
    return SummarizeResponse(
        file_id=request.file_id,
        status="processing",
        message="Summary generation started"
    )


async def process_summary(
    file_id: str,
    storage_path: str,
    style: str,
    custom_instructions: Optional[str],
    language: str,
    callback_url: Optional[str]
):
    """Background task to process PDF and generate summary"""
    start_time = time.time()
    
    try:
        logger.info(f"Processing summary for file: {file_id} (language: {language})")
        
        # Download PDF from MinIO
        if not minio_client:
            raise ValueError("MinIO client not initialized")
        
        response = minio_client.get_object(
            settings.minio_bucket_files,
            storage_path
        )
        pdf_bytes = response.read()
        response.close()
        response.release_conn()
        
        logger.info(f"Downloaded PDF: {len(pdf_bytes)} bytes")
        
        # Extract text from PDF
        text = pdf_extractor.extract_text(pdf_bytes)
        if not text.strip():
            raise ValueError("No text could be extracted from the PDF")
        
        logger.info(f"Extracted text: {len(text)} characters")
        
        # Generate summary with language
        title, content, prompt_tokens, completion_tokens = summarizer.generate_summary(
            text=text,
            style=style,
            custom_instructions=custom_instructions,
            language=language
        )
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        logger.info(f"Summary generated in {processing_time_ms}ms")
        
        # Send result to callback
        result = SummaryResult(
            file_id=file_id,
            title=title,
            content=content,
            style=style,
            custom_instructions=custom_instructions,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            processing_duration_ms=processing_time_ms,
            language=language,
            status="completed"
        )
        
        await send_callback(callback_url, result)
        
    except Exception as e:
        logger.error(f"Failed to process summary for {file_id}: {e}")
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Send error to callback
        result = SummaryResult(
            file_id=file_id,
            title="",
            content="",
            style=style,
            custom_instructions=custom_instructions,
            prompt_tokens=0,
            completion_tokens=0,
            processing_duration_ms=processing_time_ms,
            language=language,
            status="failed",
            error_message=str(e)
        )
        
        await send_callback(callback_url, result)


async def send_callback(callback_url: Optional[str], result: SummaryResult):
    """Send result to callback URL"""
    if not callback_url:
        callback_url = f"{settings.backend_url}/api/v1/internal/summaries/callback"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                callback_url,
                json=result.model_dump(),
                timeout=30.0
            )
            response.raise_for_status()
            logger.info(f"Callback sent successfully to {callback_url}")
    except Exception as e:
        logger.error(f"Failed to send callback: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True
    )
