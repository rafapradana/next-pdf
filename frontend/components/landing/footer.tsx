"use client";

import Link from "next/link";
import { FileText, Github, Twitter, Linkedin, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-neutral-100 bg-white pt-16 pb-8">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="grid gap-12 md:grid-cols-4 lg:gap-24">

          {/* Brand Column */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2 group w-fit">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 border border-red-100 group-hover:scale-105 transition-transform">
                <FileText className="h-6 w-6 text-red-600" />
              </div>
              <span className="text-xl font-bold tracking-tight text-neutral-900">
                NEXT <span className="text-red-600">PDF</span>
              </span>
            </Link>
            <p className="text-neutral-500 leading-relaxed max-w-sm">
              The intelligent document platform for modern professionals.
              Upload, analyze, and understand your PDFs instantly with AI-powered insights.
            </p>
            <div className="flex gap-4 pt-2">
              {[Twitter, Github, Linkedin, Mail].map((Icon, i) => (
                <Link
                  key={i}
                  href="#"
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-neutral-50 text-neutral-500 hover:bg-neutral-100 hover:text-red-600 transition-colors"
                >
                  <Icon className="h-5 w-5" />
                </Link>
              ))}
            </div>
          </div>

          {/* Links Column 1 */}
          <div>
            <h4 className="font-bold text-neutral-900 mb-6">Product</h4>
            <ul className="space-y-4 text-sm text-neutral-500">
              {["Features", "Pricing", "How it Works", "FAQ", "Changelog"].map(item => (
                <li key={item}>
                  <Link href="#" className="hover:text-red-600 transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links Column 2 */}
          <div>
            <h4 className="font-bold text-neutral-900 mb-6">Legal & Support</h4>
            <ul className="space-y-4 text-sm text-neutral-500">
              {["Privacy Policy", "Terms of Service", "Cookie Policy", "Contact Support"].map(item => (
                <li key={item}>
                  <Link href="#" className="hover:text-red-600 transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-neutral-100 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-neutral-400">
          <p>&copy; {new Date().getFullYear()} NextPDF Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Made with ❤️ for efficiency.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
