import { Upload, FolderOpen, Eye, Sparkles } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Upload,
    title: "Upload Your PDFs",
    description: "Drag and drop your PDF files or click to browse. We support files up to 25MB.",
  },
  {
    step: "02",
    icon: FolderOpen,
    title: "Organize with Folders",
    description: "Create folders and subfolders. Drag and drop to reorganize your document library.",
  },
  {
    step: "03",
    icon: Eye,
    title: "View Your Documents",
    description: "Open any PDF in our built-in viewer with page navigation and zoom controls.",
  },
  {
    step: "04",
    icon: Sparkles,
    title: "Generate AI Summary",
    description: "Click 'Summarize', choose your style, add custom instructions, and get instant insights.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-muted/30 py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground">
            Get started in minutes. No complex setup required.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((item, index) => (
            <div key={item.step} className="relative">
              {index < steps.length - 1 && (
                <div className="absolute left-1/2 top-12 hidden h-0.5 w-full bg-border lg:block" />
              )}
              <div className="relative flex flex-col items-center text-center">
                <div className="relative mb-4 flex h-24 w-24 items-center justify-center rounded-full border-2 bg-background">
                  <span className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {item.step}
                  </span>
                  <item.icon className="h-10 w-10 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
