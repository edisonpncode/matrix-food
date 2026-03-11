"use client";

import { CldUploadWidget, CldImage } from "next-cloudinary";
import { ImagePlus, X } from "lucide-react";

interface ImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
}

export function ImageUploader({
  value,
  onChange,
  folder = "matrix-food",
}: ImageUploaderProps) {
  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block">
          <CldImage
            src={value}
            alt="Imagem"
            width={200}
            height={200}
            className="rounded-lg border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white shadow hover:bg-destructive/90"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <CldUploadWidget
          uploadPreset="matrix-food-unsigned"
          options={{
            folder,
            maxFiles: 1,
            resourceType: "image",
            sources: ["local", "camera"],
            clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
            maxImageFileSize: 5000000,
            cropping: true,
            croppingAspectRatio: 1,
            croppingShowDimensions: true,
          }}
          onSuccess={(result) => {
            if (
              typeof result.info === "object" &&
              result.info !== null &&
              "secure_url" in result.info
            ) {
              onChange(result.info.secure_url as string);
            }
          }}
        >
          {({ open }) => (
            <button
              type="button"
              onClick={() => open()}
              className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs">Enviar imagem</span>
            </button>
          )}
        </CldUploadWidget>
      )}
    </div>
  );
}
