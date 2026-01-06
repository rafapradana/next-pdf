"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  FolderOpen,
  Zap,
  Shield,
  FileText,
  Cloud,
  Share2,
  Lock,
  Search
} from "lucide-react";

// --- REFINED ANIMATION COMPONENTS ---

function AIProcessingAnim() {
  return (
    <div className="flex flex-col items-center justify-center h-full relative">
      <div className="relative h-28 w-24 bg-white border border-border rounded-xl shadow-lg flex flex-col items-center p-3 overflow-hidden z-10">
        {/* Document Lines */}
        <div className="w-full h-2 bg-muted rounded-full mb-2" />
        <div className="w-2/3 h-2 bg-muted rounded-full mb-4" />
        <div className="space-y-1.5 w-full">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-full h-1.5 bg-muted/50 rounded-full" />
          ))}
        </div>

        {/* Scanning Beam */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-primary/10 to-primary/0 border-t border-primary/50"
          animate={{ top: ["-20%", "120%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 0.5 }}
        />

        {/* Highlight Result */}
        <motion.div
          className="absolute bottom-4 left-3 right-3 h-6 bg-yellow-200/50 rounded mix-blend-multiply"
          initial={{ opacity: 0, width: "0%" }}
          animate={{ opacity: [0, 1, 0], width: ["0%", "80%", "0%"] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
        />
      </div>

      {/* Floating Badge */}
      <motion.div
        className="absolute -bottom-2 z-20 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Sparkles className="h-3 w-3" />
        Summarized
      </motion.div>
    </div>
  );
}

function OrganizationAnim() {
  return (
    <div className="flex items-center justify-center h-full relative">
      {/* Main Folder */}
      <div className="relative z-10">
        <FolderOpen className="h-20 w-20 text-blue-500 fill-blue-50" />
      </div>

      {/* Files getting sucked in */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute bg-white border border-border p-1.5 rounded shadow-sm z-20"
          initial={{ x: -80, y: -40 + (i * 30), scale: 0.8, opacity: 0 }}
          animate={{
            x: 0,
            y: 5,
            scale: 0.2,
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: 1.2,
            delay: i * 0.6,
            repeat: Infinity,
            ease: "backIn"
          }}
        >
          <FileText className="h-6 w-6 text-muted-foreground" />
        </motion.div>
      ))}
    </div>
  );
}

function CloudSyncAnim() {
  return (
    <div className="flex items-center justify-center h-full relative">
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Central Cloud */}
        <div className="z-10 bg-white p-3 rounded-2xl shadow-md border border-purple-100">
          <Cloud className="h-8 w-8 text-purple-500 fill-purple-50" />
        </div>

        {/* Orbit Rings */}
        <div className="absolute inset-0 rounded-full border border-purple-200/30" />
        <div className="absolute inset-8 rounded-full border border-purple-200/30" />

        {/* Orbiting Particles */}
        {[0, 180].map((deg, i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-full h-full"
            style={{ rotate: deg }}
            animate={{ rotate: deg + 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            <div className="absolute top-0 left-1/2 w-2 h-2 bg-purple-400 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SpeedAnim() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((prev) => (prev < 15 ? prev + 1 : 0));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Track */}
        <svg className="w-full h-full rotate-[-90deg]">
          <circle cx="50%" cy="50%" r="40" className="stroke-muted/20 fill-none stroke-[6]" />
          <motion.circle
            cx="50%" cy="50%" r="40"
            className="stroke-green-500 fill-none stroke-[6] stroke-linecap-round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: count / 15 }}
            transition={{ duration: 0.1 }}
          />
        </svg>
        {/* Inner Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-mono text-foreground flex items-baseline">
            {count}<span className="text-sm text-muted-foreground ml-0.5">s</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
        <Zap className="h-3 w-3 fill-green-600" />
        LIGHTNING FAST
      </div>
    </div>
  );
}

function SecureAnim() {
  return (
    <div className="flex items-center justify-center h-full gap-8">
      {/* Shield */}
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Shield className="h-20 w-20 text-emerald-500 fill-emerald-50/50" />
        </motion.div>
        {/* Floating Lock */}
        <motion.div
          className="absolute -bottom-2 -right-2 bg-white p-1.5 rounded-full border border-emerald-100 shadow-md"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        >
          <Lock className="h-5 w-5 text-emerald-600" />
        </motion.div>
      </div>

      {/* Encryption Status (Desktop) */}
      <div className="hidden md:flex flex-col gap-2">
        <div className="flex gap-1.5">
          {[1, 2, 3].map(i => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
        <div className="text-left">
          <div className="text-sm font-bold text-foreground">Encrypted</div>
          <div className="text-xs text-muted-foreground">End-to-end protection</div>
        </div>
      </div>
    </div>
  );
}

function ViewerAnim() {
  return (
    <div className="flex items-center justify-center h-full w-full px-4">
      {/* Browser Window Mockup */}
      <div className="w-full max-w-[260px] bg-white border border-border/60 rounded-lg shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-6 bg-muted/30 border-b flex items-center px-2 gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
          <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
          <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
        </div>
        {/* Body */}
        <div className="p-3 relative h-28 flex flex-col gap-2">
          <div className="h-2 w-3/4 bg-muted/60 rounded-full" />
          <div className="h-2 w-full bg-muted/40 rounded-full" />
          <div className="h-2 w-5/6 bg-muted/40 rounded-full" />
          <div className="h-2 w-full bg-muted/40 rounded-full" />

          {/* Magnifying Glass */}
          <motion.div
            className="absolute top-8 left-1/2 w-12 h-12 bg-white/90 backdrop-blur border rounded-full shadow-xl flex items-center justify-center"
            animate={{ x: [-20, 30, -20], y: [-5, 10, -5] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Search className="h-5 w-5 text-primary" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}


export function Features() {
  return (
    <section className="bg-background py-24 min-h-screen flex flex-col items-center">
      <div className="max-w-xl mx-auto text-center mb-16 px-6">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
          <Zap className="h-3 w-3 text-yellow-500 fill-yellow-500" />
          Features
        </div>
        <h2 className="text-3xl font-bold tracking-tight md:text-5xl mb-4">
          Everything You Need to <br />
          <span className="text-primary">Master Your PDFs</span>
        </h2>
        <p className="text-muted-foreground text-lg">
          Powerful tools designed to streamline your document workflow.
        </p>
      </div>

      {/* Container max-w-4xl to match Navbar width */}
      <div className="w-[90%] max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[200px] md:auto-rows-[220px]">

          {/* 1. AI Summaries */}
          <motion.div
            className="md:col-span-2 md:row-span-2 bg-gradient-to-b from-white to-neutral-50 border border-border/50 rounded-3xl p-6 flex flex-col hover:border-primary/50 transition-colors cursor-pointer overflow-hidden shadow-sm hover:shadow-lg group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
          >
            <div className="flex-1 flex items-center justify-center py-4">
              <AIProcessingAnim />
            </div>
            <div>
              <h3 className="font-sans text-lg font-bold text-foreground group-hover:text-primary transition-colors">AI Intelligence</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Analyze and summarize complex documents in seconds.
              </p>
            </div>
          </motion.div>

          {/* 2. Smart Folders */}
          <motion.div
            className="md:col-span-2 bg-gradient-to-b from-white to-neutral-50 border border-border/50 rounded-3xl p-6 flex flex-col hover:border-blue-400/50 transition-colors cursor-pointer overflow-hidden shadow-sm hover:shadow-lg group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            whileHover={{ y: -5 }}
          >
            <div className="flex-1 flex items-center justify-center">
              <OrganizationAnim />
            </div>
            <div className="mt-2 text-center">
              <h3 className="font-sans text-lg font-bold text-foreground group-hover:text-blue-500 transition-colors">Smart Organization</h3>
              <p className="text-muted-foreground text-sm">Drag-and-drop file management.</p>
            </div>
          </motion.div>

          {/* 3. Cloud Sync */}
          <motion.div
            className="md:col-span-2 md:row-span-2 bg-gradient-to-b from-white to-neutral-50 border border-border/50 rounded-3xl p-6 flex flex-col hover:border-purple-400/50 transition-colors cursor-pointer overflow-hidden shadow-sm hover:shadow-lg group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            whileHover={{ y: -5 }}
          >
            <div className="flex-1 flex items-center justify-center py-4">
              <CloudSyncAnim />
            </div>
            <div>
              <h3 className="font-sans text-lg font-bold text-foreground group-hover:text-purple-500 transition-colors flex items-center gap-2">
                Cloud Sync
              </h3>
              <p className="text-muted-foreground text-sm mt-1">Access your library from any device, anytime, anywhere.</p>
            </div>
          </motion.div>

          {/* 4. Lightning Fast */}
          <motion.div
            className="md:col-span-2 bg-gradient-to-b from-white to-neutral-50 border border-border/50 rounded-3xl p-6 flex flex-col hover:border-green-400/50 transition-colors cursor-pointer overflow-hidden shadow-sm hover:shadow-lg group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            whileHover={{ y: -5 }}
          >
            <div className="flex-1 flex items-center justify-center">
              <SpeedAnim />
            </div>
            <div className="mt-2 text-center">
              <h3 className="font-sans text-lg font-bold text-foreground group-hover:text-green-500 transition-colors">Lightning Fast</h3>
              <p className="text-muted-foreground text-sm">Process 100+ pages instantly.</p>
            </div>
          </motion.div>

          {/* 5. Security */}
          <motion.div
            className="md:col-span-3 bg-gradient-to-b from-white to-neutral-50 border border-border/50 rounded-3xl p-6 flex flex-col md:flex-row hover:border-emerald-400/50 transition-colors cursor-pointer overflow-hidden shadow-sm hover:shadow-lg group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            whileHover={{ y: -5 }}
          >
            <div className="flex-1 flex items-center justify-center md:justify-start">
              <SecureAnim />
            </div>
            <div className="mt-4 md:mt-0 md:ml-6 md:w-1/2 flex flex-col justify-center text-center md:text-left">
              <h3 className="font-sans text-lg font-bold text-foreground group-hover:text-emerald-500 transition-colors">
                Enterprise Security
              </h3>
              <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                Your documents are encrypted using AES-256 for maximum protection.
              </p>
            </div>
          </motion.div>

          {/* 6. Viewer */}
          <motion.div
            className="md:col-span-3 bg-gradient-to-b from-white to-neutral-50 border border-border/50 rounded-3xl p-6 flex flex-col md:flex-row-reverse hover:border-orange-400/50 transition-colors cursor-pointer overflow-hidden shadow-sm hover:shadow-lg group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            whileHover={{ y: -5 }}
          >
            <div className="flex-1 flex items-center justify-center">
              <ViewerAnim />
            </div>
            <div className="mt-4 md:mt-0 md:mr-6 md:w-1/2 flex flex-col justify-center text-center md:text-right">
              <h3 className="font-sans text-lg font-bold text-foreground group-hover:text-orange-500 transition-colors">
                Interactive Viewer
              </h3>
              <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                Built-in viewer with smart highlighting, zooming, and search capabilities.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
