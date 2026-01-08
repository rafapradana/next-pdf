"""
AI Summarization Service
Generates summaries using Google Generative AI (Gemini) with chunking support
"""

import asyncio
import google.generativeai as genai
from typing import Optional, Tuple, List, AsyncGenerator
import logging
import time
import io
from pydantic import BaseModel
from pypdf import PdfReader

from config import get_settings
from .chunker import TextChunker

logger = logging.getLogger(__name__)

# Maximum characters before chunking is applied
MAX_SINGLE_CHUNK_SIZE = 2000000 
MAX_RECURSIVE_DEPTH = 3
MAX_CONCURRENT_CHUNKS = 5
MAX_RETRIES = 3

# Summary style prompts (English)
STYLE_PROMPTS_EN = {
    "bullet_points": """Create a concise bullet-point summary of the document.
Format the output with clear bullet points (•) for main points.
Focus on the key information and main takeaways.
Keep each bullet point brief and actionable.""",
    
    "paragraph": """Create a flowing paragraph narrative summary of the document.
Write in clear, professional prose.
Organize information logically from most to least important.
Aim for 2-4 paragraphs depending on document length.""",
    
    "detailed": """Create a comprehensive detailed analysis of the document.
Use markdown headings (##) to organize sections.
Include:
- Overview/Introduction
- Key Findings or Main Points
- Supporting Details
- Conclusions
Be thorough but avoid unnecessary repetition.""",
    
    "executive": """Create an executive summary for busy decision-makers.
Start with a "Bottom Line" statement.
Follow with 3-5 key takeaways.
Focus on actionable insights and business implications.
Keep it concise - one page maximum.""",
    
    "academic": """Create an academic-style summary of the document.
Structure with these sections:
- **Abstract**: Brief overview (2-3 sentences)
- **Key Arguments/Findings**: Main points from the text
- **Methodology** (if applicable): How conclusions were reached
- **Conclusions**: Final takeaways
Use formal academic language."""
}

# Summary style prompts (Indonesian)
STYLE_PROMPTS_ID = {
    "bullet_points": """Buatlah ringkasan dokumen dalam format poin-poin singkat.
Gunakan bullet points (•) yang jelas untuk poin-poin utama.
Fokus pada informasi kunci dan kesimpulan penting.
Buat setiap poin singkat dan dapat ditindaklanjuti.
Gunakan Bahasa Indonesia yang baik dan benar.""",
    
    "paragraph": """Buatlah ringkasan dokumen dalam bentuk paragraf naratif yang mengalir.
Tulis dengan gaya prosa yang jelas dan profesional.
Susun informasi secara logis dari yang paling penting.
Buat 2-4 paragraf tergantung panjang dokumen.
Gunakan Bahasa Indonesia yang baik dan benar.""",
    
    "detailed": """Buatlah analisis detail dan komprehensif dari dokumen ini.
Gunakan heading markdown (##) untuk mengorganisir bagian-bagian.
Sertakan:
- Ikhtisar/Pendahuluan
- Temuan Kunci atau Poin Utama
- Detail Pendukung
- Kesimpulan
Buatlah menyeluruh namun hindari pengulangan.
Gunakan Bahasa Indonesia yang baik dan benar.""",
    
    "executive": """Buatlah ringkasan eksekutif untuk pengambil keputusan yang sibuk.
Mulai dengan pernyataan "Kesimpulan Utama".
Lanjutkan dengan 3-5 poin kunci.
Fokus pada wawasan yang dapat ditindaklanjuti dan implikasi bisnis.
Buat singkat - maksimal satu halaman.
Gunakan Bahasa Indonesia yang baik dan benar.""",
    
    "academic": """Buatlah ringkasan bergaya akademis dari dokumen ini.
Struktur dengan bagian-bagian ini:
- **Abstrak**: Ikhtisar singkat (2-3 kalimat)
- **Argumen/Temuan Kunci**: Poin-poin utama dari teks
- **Metodologi** (jika ada): Bagaimana kesimpulan dicapai
- **Kesimpulan**: Kesimpulan akhir
Gunakan bahasa akademis formal dalam Bahasa Indonesia."""
}

LANGUAGE_INSTRUCTIONS = {
    "en": "Write the summary in English.",
    "id": "Tulis ringkasan dalam Bahasa Indonesia yang baik dan benar."
}

# For backward compatibility
STYLE_PROMPTS = STYLE_PROMPTS_EN

class Summarizer:
    """Handles AI-powered summarization using Google Gemini with recursive chunking"""
    
    def __init__(self):
        settings = get_settings()
        self.chunker = TextChunker(max_chunk_size=12000, overlap_size=500)
        
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(settings.gemini_model)
            # Tuning params for accuracy/creativity balance
            self.generation_config = genai.types.GenerationConfig(
                temperature=0.2,   # Lower temperature for more focused/accurate results
                top_p=0.8,         # Nucleus sampling
                top_k=40,          # Top-k sampling
                max_output_tokens=4096
            )
        else:
            self.model = None
            self.generation_config = None
            logger.warning("Gemini API key not configured")

    async def validate_pdf(self, file_content: bytes) -> bool:
        """Strictly validate PDF file content"""
        if not file_content.startswith(b'%PDF-'):
            return False
        try:
            reader = PdfReader(io.BytesIO(file_content))
            return len(reader.pages) > 0
        except Exception:
            return False

    def generate_summary(
        self,
        text: str,
        style: str = "bullet_points",
        custom_instructions: Optional[str] = None,
        title_hint: Optional[str] = None,
        language: str = "en"
    ) -> Tuple[str, str, int, int]:
        """Synchronous wrapper for backward compatibility"""
        logger.warning("Using synchronous generate_summary wrapper. Use stream for parallel processing.")
        
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(
                self._generate_summary_async(text, style, custom_instructions, title_hint, language)
            )
        finally:
            loop.close()

    async def _generate_summary_async(
        self,
        text: str,
        style: str,
        custom_instructions: Optional[str],
        title_hint: Optional[str],
        language: str
    ) -> Tuple[str, str, int, int]:
        """Async version of simple summary (legacy path, not used by stream)"""
        # This is a fallback or for non-stream uses
        prompts = STYLE_PROMPTS_ID if language == "id" else STYLE_PROMPTS_EN
        style_prompt = prompts.get(style, prompts["bullet_points"])
        lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])
        
        full_prompt = f"""
LANGUAGE REQUIREMENT: {lang_instruction}
STYLE: {style_prompt}
{f"INSTRUCTIONS: {custom_instructions}" if custom_instructions else ""}

DOCUMENT CONTENT:
---
{text}
---

TASK:
1. Analyze the document.
2. Provide a title and summary.

Format:
TITLE: [Concise Title]
SUMMARY:
[Summary Content]
"""
        response = await self.model.generate_content_async(
            full_prompt,
            generation_config=self.generation_config
        )
        
        # Approximate tokens if not provided
        prompt_tokens = int(len(full_prompt) / 4) 
        completion_tokens = int(len(response.text) / 4)
        
        if response.usage_metadata:
             prompt_tokens = response.usage_metadata.prompt_token_count
             completion_tokens = response.usage_metadata.candidates_token_count
        
        title, summary = self._parse_response(response.text, title_hint)
        return title, summary, prompt_tokens, completion_tokens

    async def generate_summary_stream(
        self,
        text: str,
        style: str = "bullet_points",
        custom_instructions: Optional[str] = None,
        language: str = "en"
    ) -> AsyncGenerator[dict, None]:
        """
        Generate summary with streaming logs and parallel processing.
        Yields log messages and final result.
        """
        if not self.model:
            yield {"error": "Gemini API key not configured"}
            return

        total_tokens = {"prompt": 0, "completion": 0}
        
        try:
            yield {"log": f"Analyzing document ({len(text)} chars)..."}
            
            async def process_text(current_text: str, depth: int = 1):
                if depth > MAX_RECURSIVE_DEPTH:
                    yield {"log": f"Max recursive depth reached at level {depth}. Summarizing directly."}
                    res = await self._summarize_single_async(current_text, style, custom_instructions, language, total_tokens)
                    yield {"final_text": res}
                    return

                if len(current_text) <= MAX_SINGLE_CHUNK_SIZE:
                    yield {"log": "Processing single chunk..."}
                    res = await self._summarize_single_async(current_text, style, custom_instructions, language, total_tokens)
                    yield {"final_text": res}
                    return
                
                yield {"log": f"Chunking text (Level {depth})..."}
                chunks = await self.chunker.chunk_text(current_text)
                yield {"log": f"Created {len(chunks)} chunks. Processing in parallel..."}
                
                semaphore = asyncio.Semaphore(MAX_CONCURRENT_CHUNKS)
                
                tasks = []
                for i, chunk in enumerate(chunks):
                    yield {"log": f"Queued chunk {i+1}/{len(chunks)}..."}
                    task = self._summarize_chunk_async(
                        chunk, style, custom_instructions, i, len(chunks), language, total_tokens, semaphore
                    )
                    tasks.append(task)
                
                try:
                    chunk_summaries = await asyncio.gather(*tasks)
                    yield {"log": f"All {len(chunks)} chunks processed successfully."}
                except Exception as e:
                    yield {"error": f"Parallel processing failed: {str(e)}"}
                    raise e

                yield {"log": "Merging chunk summaries..."}
                merged_text = "\n\n".join(chunk_summaries)
                
                if len(merged_text) > MAX_SINGLE_CHUNK_SIZE:
                    yield {"log": f"Merged summary is still large ({len(merged_text)} chars). Recursively summarizing (Level {depth+1})..."}
                    async for event in process_text(merged_text, depth + 1):
                        yield event
                    return
                
                yield {"log": "Finalizing merged summary..."}
                res = await self._merge_chunk_summaries_async(chunk_summaries, style, language, total_tokens)
                yield {"final_text": res}

            final_summary = ""
            async for event in process_text(text):
                if "final_text" in event:
                    final_summary = event["final_text"]
                else:
                    yield event
            
            title = "Document Summary"
            if "TITLE:" in final_summary:
                parts = final_summary.split("SUMMARY:", 1)
                if len(parts) == 2:
                    title = parts[0].replace("TITLE:", "").strip().split("\n")[0]
                    final_summary = parts[1].strip()
            
            yield {
                "result": {
                    "title": title,
                    "content": final_summary,
                    "prompt_tokens": total_tokens["prompt"],
                    "completion_tokens": total_tokens["completion"]
                }
            }

        except Exception as e:
            logger.error(f"Stream summarization failed: {e}")
            yield {"error": str(e)}

    async def _summarize_single_async(
        self,
        text: str,
        style: str,
        custom_instructions: Optional[str],
        language: str,
        tokens_dict: dict
    ) -> str:
        """Async version of single chunk summary"""
        prompts = STYLE_PROMPTS_ID if language == "id" else STYLE_PROMPTS_EN
        style_prompt = prompts.get(style, prompts["bullet_points"])
        lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])
        
        full_prompt = f"""
LANGUAGE REQUIREMENT: {lang_instruction}
STYLE: {style_prompt}
{f"INSTRUCTIONS: {custom_instructions}" if custom_instructions else ""}

DOCUMENT CONTENT:
---
{text}
---

TASK:
1. User strict accuracy.
2. Provide:
   TITLE: [Title]
   SUMMARY:
   [Content]
"""
        response = await self.model.generate_content_async(
            full_prompt,
            generation_config=self.generation_config
        )
        
        if response.usage_metadata:
             tokens_dict["prompt"] += response.usage_metadata.prompt_token_count
             tokens_dict["completion"] += response.usage_metadata.candidates_token_count
        
        return response.text

    async def _summarize_chunk_async(
        self, 
        chunk: str, 
        style: str, 
        custom_instructions: Optional[str], 
        index: int, 
        total: int, 
        language: str,
        tokens_dict: dict,
        semaphore: asyncio.Semaphore
    ) -> str:
        """Process a single chunk asynchronously"""
        async with semaphore:
            prompts = STYLE_PROMPTS_ID if language == "id" else STYLE_PROMPTS_EN
            style_prompt = prompts.get(style, prompts["bullet_points"])
            lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])

            prompt = f"""
Part {index + 1}/{total} of document.
LANGUAGE: {lang_instruction}
STYLE: {style_prompt}
{f"Instructions: {custom_instructions}" if custom_instructions else ""}

CONTENT:
---
{chunk}
---

Provide a summary of this section.
"""
            
            for attempt in range(MAX_RETRIES):
                try:
                    response = await self.model.generate_content_async(
                        prompt,
                        generation_config=genai.types.GenerationConfig(
                            temperature=0.2,
                            top_p=0.8,
                            top_k=40,
                            max_output_tokens=1024
                        )
                    )
                    
                    if response.usage_metadata:
                        tokens_dict["prompt"] += response.usage_metadata.prompt_token_count
                        tokens_dict["completion"] += response.usage_metadata.candidates_token_count
                    
                    return response.text
                
                except Exception as e:
                    is_rate_limit = "429" in str(e) or "Too Many Requests" in str(e) or "quota" in str(e).lower()
                    
                    if attempt < MAX_RETRIES - 1:
                        wait_time = (2 ** attempt) * 2
                        if is_rate_limit:
                            logger.warning(f"Chunk {index+1} hit rate limit. Retrying in {wait_time}s...")
                        else:
                            logger.warning(f"Chunk {index+1} failed ({str(e)}). Retrying in {wait_time}s...")
                        
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Chunk {index+1} failed after {MAX_RETRIES} attempts: {e}")
                        raise e
            return ""

    async def _merge_chunk_summaries_async(self, summaries: List[str], style: str, language: str, tokens_dict: dict) -> str:
        """Merge summaries asynchronously"""
        combined = "\n\n".join(summaries)
        lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])
        
        prompt = f"""
Merge these summaries into one cohesive {style} summary.
LANGUAGE: {lang_instruction}

SUMMARIES:
{combined}

Format:
TITLE: [Concise Title]
SUMMARY:
[Unified Summary]
"""
        response = await self.model.generate_content_async(
            prompt,
            generation_config=self.generation_config
        )
        
        if response.usage_metadata:
             tokens_dict["prompt"] += response.usage_metadata.prompt_token_count
             tokens_dict["completion"] += response.usage_metadata.candidates_token_count
             
        return response.text

    def _parse_response(self, response_text: str, title_hint: Optional[str] = None) -> Tuple[str, str]:
        """Parse the model response to extract title and summary"""
        title = title_hint or "Document Summary"
        summary = response_text
        
        if "TITLE:" in response_text:
            parts = response_text.split("SUMMARY:", 1)
            if len(parts) == 2:
                title_part = parts[0]
                summary = parts[1].strip()
                title_lines = title_part.replace("TITLE:", "").strip().split("\n")
                if title_lines:
                    title = title_lines[0].strip()[:100]
        
        return title, summary

    @staticmethod
    def get_available_styles() -> list:
        """Return list of available summary styles"""
        return [
            {"id": "bullet_points", "name": "Bullet Points"},
            {"id": "paragraph", "name": "Paragraph"},
            {"id": "detailed", "name": "Detailed Analysis"},
            {"id": "executive", "name": "Executive Summary"},
            {"id": "academic", "name": "Academic Style"}
        ]
