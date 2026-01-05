import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    question: "What file types are supported?",
    answer: "Currently, NEXT PDF supports PDF files only. We focus on providing the best possible experience for PDF documents, including text extraction and AI summarization.",
  },
  {
    question: "What is the maximum file size?",
    answer: "You can upload PDF files up to 25MB in size. This limit ensures fast processing and optimal performance for AI summarization.",
  },
  {
    question: "How long does it take to generate a summary?",
    answer: "Most summaries are generated in under 15 seconds. The exact time depends on the document length and complexity. You can see the processing time displayed with each summary.",
  },
  {
    question: "Can I customize the AI summaries?",
    answer: "Yes! You can choose from 5 different summary styles (Bullet Points, Paragraph, Detailed, Executive, Academic) and add custom instructions up to 500 characters to guide the AI.",
  },
  {
    question: "Are my documents secure?",
    answer: "Absolutely. Your documents are encrypted and stored securely using MinIO object storage. We use JWT authentication to protect your account, and each user can only access their own files.",
  },
  {
    question: "Can I organize my documents into folders?",
    answer: "Yes! NEXT PDF features a full folder system with drag-and-drop support. You can create nested folders, move files between folders, and reorganize your entire document library with ease.",
  },
  {
    question: "Can I regenerate summaries with different settings?",
    answer: "Yes, you can regenerate summaries at any time with different styles or custom instructions. Previous summary versions are preserved, so you can always go back to earlier versions.",
  },
  {
    question: "Is there a free plan?",
    answer: "We're currently in MVP phase. Sign up now to get early access and help shape the future of NEXT PDF!",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="bg-muted/30 py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-muted-foreground">
            Got questions? We&apos;ve got answers.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
