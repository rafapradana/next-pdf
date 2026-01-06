"use client";

import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { MessageCircleQuestion } from "lucide-react";

const faqs = [
  {
    question: "What file types do you support?",
    answer: "Currently, we specialize in PDF documents. Our processing engine is optimized to extract text, tables, and formatting from standard PDFs to provide the best AI analysis experience.",
  },
  {
    question: "Is there a file size limit?",
    answer: "Yes, the current limit is 25MB per file. This allows us to ensure lightning-fast processing for all users. For text-heavy PDFs, this usually covers hundreds of pages.",
  },
  {
    question: "How accurate is the AI summary?",
    answer: "We use advanced Large Language Models (LLMs) that are state-of-the-art in reading comprehension. While extremely accurate, we always recommend verifying critical details in the original document using our built-in viewer.",
  },
  {
    question: "Can I use NextPDF on my phone?",
    answer: "Absolutely. NextPDF is a fully reactive web application. You can upload, read, and chat with your documents from any smartphone or tablet with a modern browser.",
  },
  {
    question: "Is my data private and secure?",
    answer: "Security is our top priority. Files are encrypted at rest using AES-256 and transferred via secure SSL/TLS channels. Your personal documents are never used to train our public models.",
  },
  {
    question: "How does 'Smart Folder' organization work?",
    answer: "Our system analyzes the metadata and content of your uploads to suggest logical folder structures. You can also manually create folders and drag-and-drop files to keep your workspace tidy.",
  },
  {
    question: "Can I export the summaries?",
    answer: "Yes, you can copy summaries to your clipboard with one click or export them as markdown/text files to use in your notes, reports, or emails.",
  },
  {
    question: "Is there a free trial?",
    answer: "We offer a generous free tier that lets you process a limited number of documents per month. No credit card is required to get started.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="bg-background py-24 mb-20">
      <div className="w-[90%] max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6"
          >
            <MessageCircleQuestion className="h-6 w-6 text-primary" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold tracking-tight md:text-5xl mb-4"
          >
            Frequently Asked Questions
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground"
          >
            Everything you need to know about NextPDF.
          </motion.p>
        </div>

        <div className="grid gap-4">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <AccordionItem
                  value={`item-${index}`}
                  className="border border-border/60 rounded-2xl px-6 py-2 bg-card/50 hover:bg-card hover:border-primary/20 transition-all duration-300 shadow-sm hover:shadow-md data-[state=open]:border-primary/50 data-[state=open]:shadow-lg active:scale-[0.99]"
                >
                  <AccordionTrigger className="text-left text-lg font-medium hover:no-underline py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-base leading-relaxed pb-6">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
