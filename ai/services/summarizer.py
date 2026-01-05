"""
AI Summarization Service
Generates summaries using Google Gemini API with chunking support for large documents
"""

import google.generativeai as genai
from typing import Optional, Tuple, List
import logging
import time

from config import get_settings
from .chunker import TextChunker

logger = logging.getLogger(__name__)

# Maximum characters before chunking is applied
MAX_SINGLE_CHUNK_SIZE = 30000


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

