"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export function FileUploader({ file, onFileChange, disabled }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (f: File): string | null => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["xls", "xlsx", "xlsm"].includes(ext ?? "")) {
      return "Please upload an Excel file (.xls, .xlsx, or .xlsm)";
    }
    if (f.size > 50 * 1024 * 1024) {
      return "File is too large (max 50 MB)";
    }
    return null;
  };

  const handleFile = useCallback(
    (f: File) => {
      const err = validateFile(f);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      onFileChange(f);
    },
    [onFileChange]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [disabled, handleFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx,.xlsm"
        className="hidden"
        onChange={onInputChange}
        disabled={disabled}
      />

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => !disabled && inputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-all duration-200",
              isDragging
                ? "border-[#ff4b4b] bg-[#ff4b4b]/10 scale-[1.01]"
                : "border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-white/5 hover:border-slate-400 dark:hover:border-white/40 hover:bg-slate-100 dark:hover:bg-white/8",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <motion.div
              animate={isDragging ? { scale: 1.15 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15"
            >
              <Upload
                className={cn(
                  "h-7 w-7 transition-colors",
                  isDragging ? "text-[#ff4b4b]" : "text-slate-400 dark:text-white/50"
                )}
              />
            </motion.div>

            <div className="text-center space-y-1">
              <p className="text-slate-900 dark:text-white font-semibold text-sm sm:text-base">
                {isDragging ? "Drop your file here" : "Drag & drop your Excel file"}
              </p>
              <p className="text-slate-500 dark:text-white/40 text-xs sm:text-sm">
                or{" "}
                <span className="text-[#ff4b4b] font-semibold underline underline-offset-2">
                  browse files
                </span>
              </p>
              <p className="text-slate-400 dark:text-white/30 text-xs mt-2">
                Supports .xls, .xlsx, .xlsm (max 50 MB)
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="file-info"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/8 px-5 py-4"
          >
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-green-500/15 border border-green-500/25 shrink-0">
              <FileSpreadsheet className="h-5 w-5 text-green-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-slate-900 dark:text-white font-semibold text-sm truncate">{file.name}</p>
              <p className="text-slate-500 dark:text-white/40 text-xs mt-0.5">{formatBytes(file.size)}</p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onFileChange(null);
                setError(null);
              }}
              disabled={disabled}
              className="shrink-0 text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl w-9 h-9"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400 text-sm"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
