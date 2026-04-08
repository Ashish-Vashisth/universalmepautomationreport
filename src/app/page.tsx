"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/header";
import { FileUploader } from "@/components/file-uploader";
import { Dashboard } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Download, Loader2, BarChart3 } from "lucide-react";
import { processReport, generateExcelReport } from "@/lib/report";
import type { ReportResult } from "@/types";
import { cn } from "@/lib/utils";

type ProcessingStep = "idle" | "reading" | "processing" | "done" | "error";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [threshold, setThreshold] = useState(75);
  const [step, setStep] = useState<ProcessingStep>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reportBlob, setReportBlob] = useState<Blob | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!file) return;
    setStep("reading");
    setProgress(10);
    setErrorMsg(null);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      setStep("processing");
      setProgress(40);

      // Small yield to let UI update before heavy computation
      await new Promise((r) => setTimeout(r, 30));

      const reportResult = processReport(buffer, threshold);
      setProgress(80);

      const blob = generateExcelReport(reportResult);
      setProgress(100);

      setResult(reportResult);
      setReportBlob(blob);
      setStep("done");
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Unexpected error. Please check the file format and column structure.";
      setErrorMsg(msg);
      setStep("error");
      setProgress(0);
    }
  }, [file, threshold]);

  const handleDownload = useCallback(() => {
    if (!reportBlob) return;
    const url = URL.createObjectURL(reportBlob);
    const a = document.createElement("a");
    const date = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `ZERO & SUPPLY LESS THAN THRESHOLD SITES ${date}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [reportBlob]);

  const isProcessing = step === "reading" || step === "processing";
  const isDone = step === "done";

  return (
    <main className="min-h-screen px-4 pb-12">
      <Header />

      <div className="max-w-5xl mx-auto mt-6 space-y-5">
        {/* Upload Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="glass-card p-6 space-y-5"
        >
          {/* Title */}
          <div className="space-y-1">
            <h2 className="text-slate-900 dark:text-white font-bold text-lg sm:text-xl">
              Generate Daily Report
            </h2>
            <p className="text-slate-500 dark:text-white/40 text-sm">
              Upload your JJMUP export (.xls / .xlsx / .xlsm) to generate a formatted analysis.
            </p>
          </div>

          {/* Threshold input */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-slate-600 dark:text-white/60 text-sm font-medium whitespace-nowrap">
              Supply threshold (%):
            </label>
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={threshold}
              onChange={(e) => {
                const v = Math.min(100, Math.max(1, Number(e.target.value)));
                setThreshold(v);
              }}
              disabled={isProcessing}
              className={cn(
                "w-24 h-9 rounded-lg border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white text-sm text-center px-3",
                "focus:outline-none focus:border-[#ff4b4b]/50 focus:ring-1 focus:ring-[#ff4b4b]/30",
                "disabled:opacity-50"
              )}
            />
          </div>

          {/* File uploader */}
          <FileUploader
            file={file}
            onFileChange={(f) => {
              setFile(f);
              if (f === null) {
                setStep("idle");
                setResult(null);
                setErrorMsg(null);
                setProgress(0);
              }
            }}
            disabled={isProcessing}
          />

          {/* Progress bar (while processing) */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-white/40">
                  <span>
                    {step === "reading" ? "Reading file…" : "Processing data…"}
                  </span>
                  <span>{progress}%</span>
                </div>
                <Progress
                  value={progress}
                  className="h-1.5 bg-slate-200 dark:bg-white/10 [&>div]:bg-[#ff4b4b] [&>div]:transition-all"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error message */}
          <AnimatePresence>
            {step === "error" && errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-red-400 text-sm"
              >
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold mb-0.5">Processing Error</p>
                  <p className="text-red-400/80">{errorMsg}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handleGenerate}
              disabled={!file || isProcessing}
              className={cn(
                "btn-red px-6 py-2.5 h-auto font-bold text-sm rounded-xl transition-all shadow-lg",
                "hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100",
                "disabled:cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </div>

          {/* Success notice */}
          <AnimatePresence>
            {isDone && result && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-green-400 text-sm"
              >
                <span className="text-green-400 text-lg leading-none">✓</span>
                <span>
                  Report generated for{" "}
                  <strong>{result.totalSchemes}</strong> schemes.{" "}
                  {result.lessRows.length} sites below threshold ·{" "}
                  {result.zeroRows.length} inactive ·{" "}
                  {result.abnormalRows.length} abnormal
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Dashboard */}
        <AnimatePresence>
          {isDone && result && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
            >
              <Dashboard result={result} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Download button at the bottom */}
        <AnimatePresence>
          {isDone && reportBlob && (
            <motion.div
              key="download-bottom"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.2 }}
              className="flex justify-center pt-2 pb-4"
            >
              <Button
                onClick={handleDownload}
                className={cn(
                  "px-8 py-3 h-auto font-semibold text-sm rounded-xl transition-all shadow-md",
                  "bg-white text-slate-900 border border-slate-200",
                  "hover:shadow-lg active:scale-[0.98]",
                  "dark:bg-white/5 dark:text-white dark:border-white/10"
                )}
              >
                <span className="inline-flex items-center justify-center mr-3 rounded-md bg-blue-50 text-blue-600 p-2 shadow-sm">
                  <Download className="h-4 w-4" />
                </span>
                Download Excel Report
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
