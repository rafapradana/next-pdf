"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion"; // Switching to Framer Motion for better bounce
import { ChevronLeft, ChevronRight, Star, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const testimonials = [
    {
        id: 1,
        text: "Summarizing 50-page legal contracts used to take me hours. With NextPDF, I get the key points in seconds. It's actually magic.",
        name: "Sarah Jenkins",
        role: "Legal Consultant",
        img: "https://i.pravatar.cc/150?u=sarah",
    },
    {
        id: 2,
        text: "The 'Chat with PDF' feature is a game changer for my thesis research. It's like having a co-author who knows every citation.",
        name: "David Chen",
        role: "PhD Candidate",
        img: "https://i.pravatar.cc/150?u=david",
    },
    {
        id: 3,
        text: "Finally, a PDF tool that feels modern. The UI is incredibly clean, and the AI accuracy is surprisingly good.",
        name: "Marcus Johnson",
        role: "Product Designer",
        img: "https://i.pravatar.cc/150?u=marcus",
    },
    {
        id: 4,
        text: "I manage hundreds of invoices. The Smart Folders organization automatically sorting them saved my sanity.",
        name: "Emily Davis",
        role: "Small Business Owner",
        img: "https://i.pravatar.cc/150?u=emily",
    },
    {
        id: 5,
        text: "Cross-device sync is flawless. I started reading on my laptop and finished the summary on my phone during commute.",
        name: "Alex Rivera",
        role: "Tech Journalist",
        img: "https://i.pravatar.cc/150?u=alex",
    },
    {
        id: 6,
        text: "The detailed analysis mode catches nuances that other AI summarizers completely miss. Highly recommended.",
        name: "Dr. Alisha Patel",
        role: "Medical Researcher",
        img: "https://i.pravatar.cc/150?u=alisha",
    },
    {
        id: 7,
        text: "It's so fast. I dropped a 100MB handbook and it was ready to query instantly. How do you guys do this?",
        name: "Chris Thompson",
        role: "Operations Manager",
        img: "https://i.pravatar.cc/150?u=chris",
    },
    {
        id: 8,
        text: "Best investment for our team this year. We spend less time reading fluff and more time acting on data.",
        name: "Jessica Wu",
        role: "Marketing Director",
        img: "https://i.pravatar.cc/150?u=jessica",
    },
    {
        id: 9,
        text: "I love that I can choose the summary style. Bullet points for meetings, detailed paragraphs for reports.",
        name: "Tom Baker",
        role: "Project Lead",
        img: "https://i.pravatar.cc/150?u=tom",
    },
    {
        id: 10,
        text: "Enterprise-grade security was a must for us. NextPDF checks all the boxes while staying user-friendly.",
        name: "Amanda White",
        role: "CTO at SecureFlow",
        img: "https://i.pravatar.cc/150?u=amanda",
    },
];

export function Testimonials() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [cardSize, setCardSize] = useState(350);

    useEffect(() => {
        const updateSize = () => {
            // Responsive card size
            setCardSize(window.innerWidth < 640 ? 280 : 380);
        };
        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    };

    const getPosition = (index: number) => {
        const diff = index - currentIndex;

        // Normalize diff to handle infinite loop illusion if needed, 
        // but for simple staggered center implementation, direct diff is easiest.
        // However, to make it circular efficiently without cloning arrays, we can do some math.
        // Let's stick to the 'shifting array' visual approach or a valid circular index diff.

        // Actually, looking at the reference 'handleMove' shuffles the array.
        // Let's replicate the "List Shuffling" logic for simpler infinite scroll effect.
        // But Framer Motion `layout` prop + state shuffle is amazing for this.
        return diff;
    };

    // We'll use the "Rotating Array" approach from the reference to keep the center item always at index X
    // The reference code: "handleMove" pops/shifts the array.
    // Let's implement that state logic.

    const [activeList, setActiveList] = useState(testimonials);

    const moveCards = (step: number) => {
        const newList = [...activeList];
        if (step > 0) {
            // Move Right: Take from start, add to end (with new ID to force re-render/animation flow)
            const item = newList.shift();
            if (item) newList.push({ ...item, id: Math.random() }); // unique key hack for framer
        } else {
            // Move Left: Take from end, add to start
            const item = newList.pop();
            if (item) newList.unshift({ ...item, id: Math.random() });
        }
        setActiveList(newList);
    };

    // Auto-scroll effect
    useEffect(() => {
        const interval = setInterval(() => {
            moveCards(1);
        }, 3000); // 3 seconds
        return () => clearInterval(interval);
    }, [activeList]);

    return (
        <section id="testimonials" className="py-24 bg-neutral-50 overflow-hidden relative">
            <div className="container mx-auto px-6 mb-12 text-center relative z-10">
                <h2 className="text-3xl font-bold tracking-tight md:text-5xl mb-4">
                    Loved by <span className="text-red-600">Thousands</span>
                </h2>
                <p className="text-lg text-muted-foreground">
                    See why students, professionals, and teams trust NextPDF.
                </p>
            </div>

            <div className="relative w-full h-[500px] flex items-center justify-center">
                {/* Gradient overlays for focus */}
                <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-neutral-50 to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-neutral-50 to-transparent z-10 pointer-events-none" />

                {activeList.map((testimonial, index) => {
                    // Calculate offset from center of the array
                    // We want the MIDDLE of the array to be the "Center" card.
                    // activeList length is 10. Mid is roughly 5.
                    // However, the reference code positioned based on "Relative to center".
                    // Let's find the relative index from the "Center" visual point.

                    const centerIndex = Math.floor(activeList.length / 2);
                    const dist = index - centerIndex;
                    const isCenter = index === centerIndex;

                    // Only render visible range to save performance
                    if (Math.abs(dist) > 3) return null;

                    return (
                        <motion.div
                            key={testimonial.id}
                            layout
                            initial={false}
                            className={cn(
                                "absolute cursor-pointer rounded-3xl p-8 border-2 flex flex-col justify-between backdrop-blur-sm transition-colors",
                                isCenter
                                    ? "bg-white border-primary shadow-2xl z-20"
                                    : "bg-white/80 border-border/50 shadow-lg z-10 hover:border-primary/30"
                            )}
                            style={{
                                width: cardSize,
                                height: cardSize * 0.85, // slightly rectangular
                            }}
                            animate={{
                                x: dist * (cardSize * 0.65), // Overlap factor
                                y: isCenter ? 0 : dist % 2 === 0 ? 20 : -20, // Stagger effect
                                scale: isCenter ? 1 : 0.85,
                                opacity: isCenter ? 1 : 0.5,
                                rotate: isCenter ? 0 : dist * 4,
                                zIndex: isCenter ? 10 : 5 - Math.abs(dist)
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 200,
                                damping: 20, // Bouncy feel
                                mass: 0.8
                            }}
                            onClick={() => {
                                if (dist !== 0) moveCards(dist);
                            }}
                        >
                            {/* Content */}
                            <div>
                                <Quote className={cn("h-8 w-8 mb-4", isCenter ? "text-primary fill-primary/10" : "text-muted-foreground/30")} />
                                <p className={cn(
                                    "font-medium leading-relaxed font-sans",
                                    isCenter ? "text-lg text-foreground" : "text-sm text-muted-foreground"
                                )}>
                                    "{testimonial.text}"
                                </p>
                            </div>

                            <div className="flex items-center gap-4 mt-6">
                                <img
                                    src={testimonial.img}
                                    alt={testimonial.name}
                                    className="w-10 h-10 rounded-full object-cover border border-border"
                                />
                                <div>
                                    <div className={cn("font-bold text-sm", isCenter ? "text-foreground" : "text-muted-foreground")}>
                                        {testimonial.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {testimonial.role}
                                    </div>
                                </div>
                            </div>

                            {isCenter && (
                                <div className="absolute -top-3 -right-3 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                                    <Star className="h-3 w-3 fill-yellow-900" />
                                    Top Rated
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            <div className="flex justify-center gap-4 mt-8 pb-12">
                <button
                    onClick={() => moveCards(-1)}
                    className="w-12 h-12 rounded-full border border-border bg-white flex items-center justify-center hover:bg-primary hover:text-white hover:scale-110 active:scale-95 transition-all shadow-sm"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                    onClick={() => moveCards(1)}
                    className="w-12 h-12 rounded-full border border-border bg-white flex items-center justify-center hover:bg-primary hover:text-white hover:scale-110 active:scale-95 transition-all shadow-sm"
                >
                    <ChevronRight className="h-5 w-5" />
                </button>
            </div>
        </section>
    );
}
