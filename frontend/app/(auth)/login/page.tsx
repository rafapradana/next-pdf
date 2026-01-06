"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await login(email, password);

    if (result.success) {
      router.push("/app");
    } else {
      setError(result.error || "Login failed");
    }

    setIsLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header - Clean, no card */}
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Welcome back
        </h1>
        <p className="text-neutral-500">
          Please enter your details to sign in
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="p-3 text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
            {error}
          </motion.div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-neutral-700">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-xl bg-neutral-50 border-neutral-200 focus:bg-white focus:border-red-500/50 focus:ring-red-500/20 transition-all font-medium"
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-neutral-700">Password</Label>
            <Link href="#" className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl bg-neutral-50 border-neutral-200 focus:bg-white focus:border-red-500/50 focus:ring-red-500/20 transition-all font-medium pr-10"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              className="absolute right-0 top-0 h-full px-3 text-neutral-400 hover:text-neutral-600 transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <>Sign in <ArrowRight className="ml-2 h-4 w-4 opacity-80" /></>
          )}
        </Button>
      </form>

      {/* Footer */}
      <div className="text-center text-sm mt-8">
        <span className="text-neutral-500">Don&apos;t have an account? </span>
        <Link href="/register" className="font-semibold text-neutral-900 hover:text-red-600 transition-colors">
          Sign up for free
        </Link>
      </div>
    </motion.div>
  );
}
