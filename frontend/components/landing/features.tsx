import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FolderTree, FileText, Sparkles, Clock, Shield } from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Easy Upload",
    description: "Drag and drop your PDFs or click to upload. Support for files up to 25MB with instant processing.",
  },
  {
    icon: FolderTree,
    title: "Smart Organization",
    description: "Create nested folders and organize your documents with intuitive drag-and-drop. Keep everything tidy.",
  },
  {
    icon: FileText,
    title: "Built-in PDF Viewer",
    description: "View your PDFs directly in the browser with page navigation, zoom controls, and smooth scrolling.",
  },
  {
    icon: Sparkles,
    title: "AI Summaries",
    description: "Generate intelligent summaries on-demand with 5 different styles. Add custom instructions for personalized results.",
  },
  {
    icon: Clock,
    title: "Fast Processing",
    description: "Get your summaries in under 15 seconds. Track processing time and regenerate with different styles anytime.",
  },
  {
    icon: Shield,
    title: "Secure Storage",
    description: "Your documents are encrypted and stored securely. JWT authentication keeps your data protected.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            Everything You Need to Master Your PDFs
          </h2>
          <p className="text-lg text-muted-foreground">
            A complete document management solution with AI-powered intelligence built right in.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border-2 transition-colors hover:border-primary/50">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
