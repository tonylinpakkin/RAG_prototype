import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { CloudUpload, X, File, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UploadFile extends File {
  id: string;
  progress?: number;
  status?: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export function FileUploadModal({ isOpen, onClose }: FileUploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [generateEmbeddings, setGenerateEmbeddings] = useState(true);
  const [extractMetadata, setExtractMetadata] = useState(true);
  const [enableOCR, setEnableOCR] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: UploadFile) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("generateEmbeddings", generateEmbeddings.toString());
      formData.append("extractMetadata", extractMetadata.toString());
      formData.append("enableOCR", enableOCR.toString());

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data, file) => {
      setFiles(prev =>
        prev.map(f =>
          f.id === file.id
            ? { ...f, status: "success", progress: 100 }
            : f
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Upload successful",
        description: `${file.name} has been uploaded and is being processed.`,
      });
    },
    onError: (error: Error, file) => {
      setFiles(prev =>
        prev.map(f =>
          f.id === file.id
            ? { ...f, status: "error", error: error.message }
            : f
        )
      );
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      ...file,
      id: Math.random().toString(36).substring(7),
      status: "pending" as const,
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/html': ['.html'],
      'text/csv': ['.csv'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const startUpload = async () => {
    const pendingFiles = files.filter(f => f.status === "pending");
    
    for (const file of pendingFiles) {
      setFiles(prev =>
        prev.map(f =>
          f.id === file.id
            ? { ...f, status: "uploading", progress: 0 }
            : f
        )
      );
      
      try {
        await uploadMutation.mutateAsync(file);
      } catch (error) {
        // Error handling is done in the mutation
      }
    }
  };

  const handleClose = () => {
    if (files.some(f => f.status === "uploading")) {
      toast({
        title: "Upload in progress",
        description: "Please wait for uploads to complete before closing.",
        variant: "destructive",
      });
      return;
    }
    setFiles([]);
    onClose();
  };

  const canUpload = files.length > 0 && files.some(f => f.status === "pending");
  const isUploading = files.some(f => f.status === "uploading");

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
        </DialogHeader>

        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
        >
          <input {...getInputProps()} />
          <CloudUpload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">
            {isDragActive ? "Drop files here" : "Drop files here to upload"}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse files
          </p>
          <Button type="button">Choose Files</Button>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center space-x-3 p-3 bg-muted rounded-lg"
              >
                <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {file.status === "uploading" && file.progress !== undefined && (
                    <Progress value={file.progress} className="mt-1" />
                  )}
                  {file.status === "error" && file.error && (
                    <p className="text-xs text-destructive mt-1">{file.error}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {file.status === "pending" && (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                  {file.status === "uploading" && (
                    <Badge variant="secondary">Uploading...</Badge>
                  )}
                  {file.status === "success" && (
                    <Badge variant="default" className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      Success
                    </Badge>
                  )}
                  {file.status === "error" && (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                  )}
                  {file.status === "pending" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Supported Formats */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Supported Formats</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">PDF</Badge>
            <Badge variant="outline">DOCX</Badge>
            <Badge variant="outline">HTML</Badge>
            <Badge variant="outline">TXT</Badge>
            <Badge variant="outline">CSV</Badge>
          </div>
        </div>

        {/* Processing Options */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Processing Options</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="embeddings"
                checked={generateEmbeddings}
                onCheckedChange={setGenerateEmbeddings}
              />
              <Label htmlFor="embeddings" className="text-sm">
                Generate embeddings automatically
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="metadata"
                checked={extractMetadata}
                onCheckedChange={setExtractMetadata}
              />
              <Label htmlFor="metadata" className="text-sm">
                Extract metadata
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ocr"
                checked={enableOCR}
                onCheckedChange={setEnableOCR}
              />
              <Label htmlFor="ocr" className="text-sm">
                Enable OCR for scanned documents
              </Label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={startUpload}
            disabled={!canUpload || isUploading}
          >
            {isUploading ? "Uploading..." : "Start Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
