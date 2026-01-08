"""
AI Summarization Service
Generates summaries using Google Gemini API with chunking support for large documents
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
# Increased to 2M (approx 500k tokens) to leverage Gemini 1M context window
MAX_SINGLE_CHUNK_SIZE = 2000000 
MAX_RECURSIVE_DEPTH = 3
MAX_CONCURRENT_CHUNKS = 5
MAX_RETRIES = 3

# Summary style prompts (Same as before)
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

class SummaryResult(BaseModel):
    title: str
    content: str
    prompt_tokens: int
    completion_tokens: int

class Summarizer:
    """Handles AI-powered summarization using Google Gemini with recursive chunking"""
    
    def __init__(self):
        settings = get_settings()
        self.chunker = TextChunker(max_chunk_size=12000, overlap_size=500)
        
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel('gemini-2.0-flash-exp') # Using faster model
        else:
            self.model = None
            logger.warning("Gemini API key not configured")

    async def validate_pdf(self, file_content: bytes) -> bool:
        """Strictly validate PDF file content"""
        if not file_content.startswith(b'%PDF-'):
            return False
        try:
            # Try to read with pypdf to ensure structural integrity
            reader = PdfReader(io.BytesIO(file_content))
            return len(reader.pages) > 0
        except Exception:
            return False

    async def generate_summary(
        self,
        text: str,
        style: str = "bullet_points",
        custom_instructions: Optional[str] = None,
        title_hint: Optional[str] = None,
        language: str = "en"
    ) -> Tuple[str, str, int, int]:
        """Synchronous wrapper for backward compatibility"""
        # Note: This runs the async process synchronously, losing parallel benefits
        # Use generate_summary_stream for full benefits
        logger.warning("Using synchronous generate_summary wrapper. Use stream for parallel processing.")
        
        # Simple sync implementation for now (using old method if needed, or blocking run)
        # For this refactor, we encourage using the stream endpoint
        return self._summarize_single(text, style, custom_instructions, title_hint, language)

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
            yield {"log": f"Analyzing document connection ({len(text)} chars)..."}
            
            # recursive function
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
                
                # Chunking
                yield {"log": f"Chunking text (Level {depth})..."}
                chunks = await self.chunker.chunk_text(current_text)
                yield {"log": f"Created {len(chunks)} chunks. Processing in parallel..."}
                
                # Process chunks in parallel
                # Create semaphore for concurrency control
                semaphore = asyncio.Semaphore(MAX_CONCURRENT_CHUNKS)
                
                tasks = []
                for i, chunk in enumerate(chunks):
                    yield {"log": f"Queued chunk {i+1}/{len(chunks)}..."}
                    task = self._summarize_chunk_async(
                        chunk, style, custom_instructions, i, len(chunks), language, total_tokens, semaphore
                    )
                    tasks.append(task)
                
                # Gather results
                try:
                    chunk_summaries = await asyncio.gather(*tasks)
                    yield {"log": f"All {len(chunks)} chunks processed successfully."}
                except Exception as e:
                    yield {"error": f"Parallel processing failed: {str(e)}"}
                    raise e

                # Merge logic
                yield {"log": "Merging chunk summaries..."}
                merged_text = "\n\n".join(chunk_summaries)
                
                # Check if merged text is still too large (Recursive step)
                if len(merged_text) > MAX_SINGLE_CHUNK_SIZE:
                    yield {"log": f"Merged summary is still large ({len(merged_text)} chars). Recursively summarizing (Level {depth+1})..."}
                    async for event in process_text(merged_text, depth + 1):
                        yield event
                    return
                
                # Final polish of merged text
                yield {"log": "Finalizing merged summary..."}
                res = await self._merge_chunk_summaries_async(chunk_summaries, style, language, total_tokens)
                yield {"final_text": res}

            final_summary = ""
            async for event in process_text(text):
                if "final_text" in event:
                    final_summary = event["final_text"]
                else:
                    yield event
            
            # Extract title from final summary or generate one
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
1. First, analyze the document structure, key themes, and main arguments.
2. Then, create the summary following the requested style and instructions.

Provide:
1. TITLE: [A concise title]
2. SUMMARY: [The summary content]
Format:
TITLE: ...
SUMMARY:
...
"""
        response = await self.model.generate_content_async(
            full_prompt,
            generation_config=genai.types.GenerationConfig(temperature=0.3, max_output_tokens=4096) # Increased for CoT
        )
        
        # Estimate tokens (simple estimation)
        tokens_dict["prompt"] += int(len(full_prompt) / 4)
        tokens_dict["completion"] += int(len(response.text) / 4)
        
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
        """Process a single chunk asynchronously with concurrency control and retries"""
        async with semaphore:
            prompts = STYLE_PROMPTS_ID if language == "id" else STYLE_PROMPTS_EN
            style_prompt = prompts.get(style, prompts["bullet_points"])
            lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])

            prompt = f"""
You are summarizing part {index + 1}/{total} of a document.
LANGUAGE: {lang_instruction}
STYLE: {style_prompt}
{f"Instructions: {custom_instructions}" if custom_instructions else ""}

CONTENT:
---
{chunk}
---

Provide a summary of this section in the requested style.
"""
            
            for attempt in range(MAX_RETRIES):
                try:
                    response = await self.model.generate_content_async(
                        prompt,
                        generation_config=genai.types.GenerationConfig(temperature=0.3, max_output_tokens=1024)
                    )
                    tokens_dict["prompt"] += int(len(prompt) / 4)
                    tokens_dict["completion"] += int(len(response.text) / 4)
                    return response.text
                
                except Exception as e:
                    # Check for rate limit error (usually 429) or potential transient server errors
                    is_rate_limit = "429" in str(e) or "Too Many Requests" in str(e) or "quota" in str(e).lower()
                    
                    if attempt < MAX_RETRIES - 1:
                        wait_time = (2 ** attempt) * 2  # 2s, 4s, 8s
                        if is_rate_limit:
                            logger.warning(f"Chunk {index+1} hit rate limit. Retrying in {wait_time}s...")
                        else:
                            logger.warning(f"Chunk {index+1} failed ({str(e)}). Retrying in {wait_time}s...")
                        
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Chunk {index+1} failed after {MAX_RETRIES} attempts: {e}")
                        raise e
            return "" # Should not reach here due to raise

    async def _merge_chunk_summaries_async(self, summaries: List[str], style: str, language: str, tokens_dict: dict) -> str:
        """Merge summaries asynchronously"""
        combined = "\n\n".join(summaries)
        lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])
        
        prompt = f"""
Merge these document section summaries into one cohesive {style} summary.
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
            generation_config=genai.types.GenerationConfig(temperature=0.3, max_output_tokens=2048)
        )
        tokens_dict["prompt"] += int(len(prompt) / 4)
        tokens_dict["completion"] += int(len(response.text) / 4)
        return response.text

    # Keep _summarize_single for backward compatibility (sync wrapper uses it if we revert, but here we deprecated it)
    def _summarize_single(self, text: str, style: str, custom_instructions: str, title_hint: str, language: str) -> Tuple[str, str, int, int]:
        # Sync implementation fallback
        pass # Not implementing full fallback for brevity as we are moving to async

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



# Summary style prompts - English
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

# Summary style prompts - Indonesian
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

# Language instruction additions
LANGUAGE_INSTRUCTIONS = {
    "en": "Write the summary in English.",
    "id": "Tulis ringkasan dalam Bahasa Indonesia yang baik dan benar."
}

# For backward compatibility
STYLE_PROMPTS = STYLE_PROMPTS_EN


class Summarizer:
    """Handles AI-powered summarization using Google Gemini with chunking support"""
    
    def __init__(self):
        settings = get_settings()
        self.chunker = TextChunker(max_chunk_size=8000, overlap_size=200)
        
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            self.model = None
            logger.warning("Gemini API key not configured")
    
    def generate_summary(
        self,
        text: str,
        style: str = "bullet_points",
        custom_instructions: Optional[str] = None,
        title_hint: Optional[str] = None,
        language: str = "en"
    ) -> Tuple[str, str, int, int]:
        """
        Generate a summary of the given text, using chunking for large documents
        
        Args:
            text: The document text to summarize
            style: Summary style (bullet_points, paragraph, detailed, executive, academic)
            custom_instructions: Optional custom instructions from user
            title_hint: Optional filename hint for title generation
            language: Language for summary output ('en' for English, 'id' for Indonesian)
            
        Returns:
            Tuple of (title, summary_content, prompt_tokens, completion_tokens)
        """
        if not self.model:
            raise ValueError("Gemini API key not configured")
        
        # Use chunking for large documents
        if len(text) > MAX_SINGLE_CHUNK_SIZE:
            logger.info(f"Document is large ({len(text)} chars), using chunked summarization")
            return self._summarize_with_chunks(text, style, custom_instructions, title_hint, language)
        
        return self._summarize_single(text, style, custom_instructions, title_hint, language)
    
    def _summarize_single(
        self,
        text: str,
        style: str,
        custom_instructions: Optional[str],
        title_hint: Optional[str],
        language: str = "en"
    ) -> Tuple[str, str, int, int]:
        """Generate summary for a single chunk of text"""
        # Select prompts based on language
        prompts = STYLE_PROMPTS_ID if language == "id" else STYLE_PROMPTS_EN
        style_prompt = prompts.get(style, prompts["bullet_points"])
        lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])
        
        prompt_parts = [
            "You are an expert document summarizer. Your task is to create a high-quality summary.",
            "",
            "LANGUAGE REQUIREMENT:",
            lang_instruction,
            "",
            "STYLE INSTRUCTIONS:",
            style_prompt,
            "",
        ]
        
        if custom_instructions:
            prompt_parts.extend([
                "CUSTOM USER INSTRUCTIONS:",
                custom_instructions,
                "",
            ])
        
        prompt_parts.extend([
            "DOCUMENT CONTENT:",
            "---",
            text,
            "---",
            "",
            "Please provide:",
            "1. A concise, descriptive title for this document (max 100 characters)" + (" in Indonesian" if language == "id" else ""),
            "2. The summary following the style and language instructions above",
            "",
            "Format your response as:",
            "TITLE: [Your generated title]",
            "",
            "SUMMARY:",
            "[Your summary content]"
        ])
        
        full_prompt = "\n".join(prompt_parts)
        
        try:
            start_time = time.time()
            
            response = self.model.generate_content(
                full_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=2048,
                )
            )
            
            elapsed_time = time.time() - start_time
            logger.info(f"Summary generated in {elapsed_time:.2f}s")
            
            response_text = response.text
            title, summary = self._parse_response(response_text, title_hint)
            
            prompt_tokens = len(full_prompt.split()) * 1.3
            completion_tokens = len(response_text.split()) * 1.3
            
            return title, summary, int(prompt_tokens), int(completion_tokens)
            
        except Exception as e:
            logger.error(f"Failed to generate summary: {e}")
            raise ValueError(f"Failed to generate summary: {str(e)}")
    
    def _summarize_with_chunks(
        self,
        text: str,
        style: str,
        custom_instructions: Optional[str],
        title_hint: Optional[str],
        language: str = "en"
    ) -> Tuple[str, str, int, int]:
        """Generate summary using chunked processing for large documents"""
        
        # Split text into chunks
        chunks = self.chunker.chunk_text(text)
        logger.info(f"Split document into {len(chunks)} chunks")
        
        total_prompt_tokens = 0
        total_completion_tokens = 0
        chunk_summaries = []
        title = title_hint or "Document Summary"
        
        # Summarize each chunk
        for i, chunk in enumerate(chunks):
            logger.info(f"Processing chunk {i+1}/{len(chunks)}")
            
            chunk_prompt = self._build_chunk_prompt(chunk, style, custom_instructions, i, len(chunks), language)
            
            try:
                response = self.model.generate_content(
                    chunk_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.3,
                        max_output_tokens=1024,
                    )
                )
                
                chunk_summary = response.text
                chunk_summaries.append(chunk_summary)
                
                # First chunk gets the title
                if i == 0 and "TITLE:" in chunk_summary:
                    parts = chunk_summary.split("SUMMARY:", 1)
                    if len(parts) == 2:
                        title_part = parts[0].replace("TITLE:", "").strip()
                        title = title_part.split("\n")[0][:100]
                        chunk_summaries[0] = parts[1].strip()
                
                total_prompt_tokens += len(chunk_prompt.split()) * 1.3
                total_completion_tokens += len(chunk_summary.split()) * 1.3
                
            except Exception as e:
                logger.error(f"Failed to summarize chunk {i+1}: {e}")
                continue
        
        if not chunk_summaries:
            raise ValueError("Failed to generate summary from any chunks")
        
        # Merge chunk summaries
        if len(chunk_summaries) == 1:
            final_summary = chunk_summaries[0]
        else:
            final_summary = self._merge_chunk_summaries(chunk_summaries, style, language)
        
        return title, final_summary, int(total_prompt_tokens), int(total_completion_tokens)
    
    def _build_chunk_prompt(
        self,
        chunk: str,
        style: str,
        custom_instructions: Optional[str],
        chunk_index: int,
        total_chunks: int,
        language: str = "en"
    ) -> str:
        """Build prompt for a single chunk"""
        prompts = STYLE_PROMPTS_ID if language == "id" else STYLE_PROMPTS_EN
        style_prompt = prompts.get(style, prompts["bullet_points"])
        lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])
        
        parts = [
            f"You are summarizing part {chunk_index + 1} of {total_chunks} of a document.",
            "",
            "LANGUAGE:", lang_instruction,
            "",
            "STYLE:", style_prompt,
        ]
        
        if custom_instructions:
            parts.extend(["", "INSTRUCTIONS:", custom_instructions])
        
        parts.extend([
            "", "CONTENT:", "---", chunk, "---", "",
        ])
        
        if chunk_index == 0:
            title_lang = "Berikan: TITLE: [judul] kemudian SUMMARY: [ringkasan]" if language == "id" else "Provide: TITLE: [title] then SUMMARY: [summary]"
            parts.append(title_lang)
        else:
            key_points = "Berikan poin-poin kunci dari bagian ini." if language == "id" else "Provide the key points from this section."
            parts.append(key_points)
        
        return "\n".join(parts)
    
    def _merge_chunk_summaries(self, summaries: List[str], style: str, language: str = "en") -> str:
        """Merge summaries from multiple chunks into final summary"""
        combined = "\n\n".join(summaries)
        lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])
        
        if language == "id":
            merge_prompt = f"""Anda memiliki ringkasan dari berbagai bagian dokumen.
Gabungkan menjadi satu ringkasan {style.replace('_', ' ')} yang kohesif.

{lang_instruction}

RINGKASAN BAGIAN:
{combined}

Buat ringkasan terpadu yang:
- Menghilangkan pengulangan
- Mempertahankan alur logis
- Menyimpan poin-poin paling penting
- Menggunakan format {style.replace('_', ' ')}"""
        else:
            merge_prompt = f"""You have summaries from different parts of a document.
Merge them into one cohesive {style.replace('_', ' ')} summary.

{lang_instruction}

CHUNK SUMMARIES:
{combined}

Create a unified summary that:
- Eliminates redundancy
- Maintains logical flow
- Keeps the most important points
- Uses {style.replace('_', ' ')} format"""
        
        try:
            response = self.model.generate_content(
                merge_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=2048,
                )
            )
            return response.text
        except Exception as e:
            logger.error(f"Failed to merge summaries: {e}")
            return self.chunker.merge_summaries(summaries, style)
    
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
        """Return list of available summary styles with descriptions"""
        return [
            {
                "id": "bullet_points",
                "name": "Bullet Points",
                "description": "Concise bullet-point format highlighting key information",
                "example_output": "• Key finding 1\n• Key finding 2\n• Key finding 3"
            },
            {
                "id": "paragraph",
                "name": "Paragraph",
                "description": "Flowing paragraph narrative for easy reading",
                "example_output": "This document discusses... The main points include..."
            },
            {
                "id": "detailed",
                "name": "Detailed Analysis",
                "description": "Comprehensive detailed analysis with sections",
                "example_output": "## Overview\n...\n## Key Findings\n...\n## Methodology\n..."
            },
            {
                "id": "executive",
                "name": "Executive Summary",
                "description": "Brief executive summary with key takeaways for quick decisions",
                "example_output": "**Bottom Line:** ...\n**Key Takeaways:**\n1. ...\n2. ..."
            },
            {
                "id": "academic",
                "name": "Academic Style",
                "description": "Academic/research style with structured sections",
                "example_output": "**Abstract:** ...\n**Methods:** ...\n**Results:** ...\n**Conclusion:** ..."
            }
        ]

