"""
Text Chunking Service
Splits large text into manageable chunks for LLM processing
"""

from typing import List, Optional
import re
import logging

logger = logging.getLogger(__name__)


class TextChunker:
    """Handles text chunking for LLM processing"""
    
    def __init__(
        self,
        max_chunk_size: int = 8000,
        overlap_size: int = 200,
        separator: str = "\n\n"
    ):
        """
        Initialize the chunker
        
        Args:
            max_chunk_size: Maximum characters per chunk
            overlap_size: Number of characters to overlap between chunks
            separator: Preferred separator for splitting
        """
        self.max_chunk_size = max_chunk_size
        self.overlap_size = overlap_size
        self.separator = separator
    
    def chunk_text(self, text: str) -> List[str]:
        """
        Split text into chunks suitable for LLM processing
        
        Args:
            text: The full text to chunk
            
        Returns:
            List of text chunks
        """
        if not text or len(text) <= self.max_chunk_size:
            return [text] if text else []
        
        chunks = []
        
        # Try to split by paragraphs first
        paragraphs = self._split_by_separator(text, self.separator)
        
        current_chunk = ""
        for para in paragraphs:
            # If single paragraph is too large, split it further
            if len(para) > self.max_chunk_size:
                # Save current chunk if exists
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                
                # Split large paragraph by sentences
                sub_chunks = self._split_large_paragraph(para)
                chunks.extend(sub_chunks)
                continue
            
            # Check if adding this paragraph exceeds limit
            test_chunk = current_chunk + self.separator + para if current_chunk else para
            
            if len(test_chunk) <= self.max_chunk_size:
                current_chunk = test_chunk
            else:
                # Save current chunk and start new one
                if current_chunk:
                    chunks.append(current_chunk.strip())
                
                # Start new chunk with overlap from previous
                overlap = self._get_overlap(current_chunk)
                current_chunk = overlap + para if overlap else para
        
        # Don't forget the last chunk
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        logger.info(f"Split text into {len(chunks)} chunks")
        return chunks
    
    def _split_by_separator(self, text: str, separator: str) -> List[str]:
        """Split text by separator, preserving empty sections"""
        parts = text.split(separator)
        return [p for p in parts if p.strip()]
    
    def _split_large_paragraph(self, paragraph: str) -> List[str]:
        """Split a large paragraph by sentences"""
        # Split by sentence endings
        sentence_pattern = r'(?<=[.!?])\s+'
        sentences = re.split(sentence_pattern, paragraph)
        
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(sentence) > self.max_chunk_size:
                # Sentence itself is too long, force split by characters
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                
                # Force split
                for i in range(0, len(sentence), self.max_chunk_size - self.overlap_size):
                    chunk = sentence[i:i + self.max_chunk_size]
                    chunks.append(chunk)
                continue
            
            test_chunk = current_chunk + " " + sentence if current_chunk else sentence
            
            if len(test_chunk) <= self.max_chunk_size:
                current_chunk = test_chunk
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _get_overlap(self, text: str) -> str:
        """Get the overlap portion from the end of text"""
        if not text or len(text) < self.overlap_size:
            return ""
        
        # Try to find a good break point (end of sentence or paragraph)
        overlap_text = text[-self.overlap_size:]
        
        # Find last sentence boundary in overlap
        last_period = overlap_text.rfind('. ')
        if last_period > 0:
            return overlap_text[last_period + 2:]
        
        # Find last word boundary
        last_space = overlap_text.rfind(' ')
        if last_space > 0:
            return overlap_text[last_space + 1:]
        
        return overlap_text
    
    def merge_summaries(self, summaries: List[str], style: str = "bullet_points") -> str:
        """
        Merge multiple chunk summaries into a final summary
        
        Args:
            summaries: List of summaries from each chunk
            style: Summary style for formatting
            
        Returns:
            Merged summary text
        """
        if not summaries:
            return ""
        
        if len(summaries) == 1:
            return summaries[0]
        
        # Combine all summaries
        if style == "bullet_points":
            # Collect all bullet points
            all_bullets = []
            for summary in summaries:
                bullets = self._extract_bullets(summary)
                all_bullets.extend(bullets)
            
            # Deduplicate similar bullets
            unique_bullets = self._deduplicate_bullets(all_bullets)
            return "\n".join(f"• {b}" for b in unique_bullets[:20])  # Limit to 20 items
        
        elif style in ["paragraph", "executive"]:
            # Combine as paragraphs
            return "\n\n".join(summaries)
        
        elif style in ["detailed", "academic"]:
            # Merge with section awareness
            return self._merge_structured_summaries(summaries)
        
        else:
            return "\n\n---\n\n".join(summaries)
    
    def _extract_bullets(self, text: str) -> List[str]:
        """Extract bullet points from text"""
        bullets = []
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            # Match various bullet formats
            if line.startswith(('• ', '- ', '* ', '· ')):
                bullets.append(line[2:].strip())
            elif re.match(r'^\d+\.\s', line):
                bullets.append(re.sub(r'^\d+\.\s*', '', line))
        
        return bullets
    
    def _deduplicate_bullets(self, bullets: List[str]) -> List[str]:
        """Remove similar/duplicate bullets"""
        if not bullets:
            return []
        
        unique = []
        seen_normalized = set()
        
        for bullet in bullets:
            # Normalize for comparison
            normalized = bullet.lower().strip()
            normalized = re.sub(r'[^\w\s]', '', normalized)
            
            # Check similarity with existing
            if normalized not in seen_normalized and len(normalized) > 10:
                unique.append(bullet)
                seen_normalized.add(normalized)
        
        return unique
    
    def _merge_structured_summaries(self, summaries: List[str]) -> str:
        """Merge structured summaries (detailed/academic)"""
        sections = {}
        other_content = []
        
        for summary in summaries:
            # Extract sections by headers
            current_section = None
            current_content = []
            
            for line in summary.split('\n'):
                if line.startswith('## ') or line.startswith('**') and line.endswith('**'):
                    if current_section and current_content:
                        if current_section not in sections:
                            sections[current_section] = []
                        sections[current_section].extend(current_content)
                    
                    current_section = line.strip('#* ')
                    current_content = []
                else:
                    current_content.append(line)
            
            # Handle last section
            if current_section and current_content:
                if current_section not in sections:
                    sections[current_section] = []
                sections[current_section].extend(current_content)
            elif current_content:
                other_content.extend(current_content)
        
        # Build merged output
        output_parts = []
        for section, content in sections.items():
            output_parts.append(f"## {section}")
            output_parts.append('\n'.join(content[:50]))  # Limit content
        
        if other_content:
            output_parts.append('\n'.join(other_content[:30]))
        
        return '\n\n'.join(output_parts)
