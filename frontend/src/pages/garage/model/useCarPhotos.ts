import { useEffect, useRef, useState } from "react";
import { uploadImage } from "@/features/upload-image";
import { apiMessage } from "@/shared/api";

export const MAX_PHOTOS = 5;
export const MAX_IMAGE_SIZE_MB = 4;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Photo = { id: string; preview: string; file?: File };

export function useCarPhotos(initialUrls: string[]) {
  const [photos, setPhotos] = useState<Photo[]>(() =>
    initialUrls.map((url) => ({ id: url, preview: url })),
  );
  const [error, setError] = useState("");
  const previews = useRef(new Set<string>());
  const uploaded = useRef(new Map<string, string>());

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (photos.length + selected.length > MAX_PHOTOS) {
      setError(`Можно добавить до ${MAX_PHOTOS} фото. Сейчас выбрано: ${photos.length}.`);
      return;
    }
    for (const file of selected) {
      const problem = validatePhoto(file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        return;
      }
    }
    const additions = selected.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { id: preview, preview, file };
    });
    setPhotos((current) => [...current, ...additions]);
    setError("");
  };

  const remove = (id: string) => {
    if (previews.current.delete(id)) URL.revokeObjectURL(id);
    uploaded.current.delete(id);
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    setError("");
  };

  const makeCover = (id: string) => {
    setPhotos((current) => [
      ...current.filter((photo) => photo.id === id),
      ...current.filter((photo) => photo.id !== id),
    ]);
  };

  const upload = async (onProgress: (message: string) => void) => {
    setError("");
    if (!photos.length) {
      setError("Добавьте хотя бы одну фотографию машины");
      return null;
    }
    const pending = photos.filter((photo) => photo.file && !uploaded.current.has(photo.id));
    for (const [index, photo] of pending.entries()) {
      onProgress(`Загружаем фото ${index + 1} из ${pending.length}…`);
      try {
        // Keep successful uploads so a retry only sends the remaining files.
        uploaded.current.set(photo.id, await uploadImage(photo.file!));
      } catch (cause) {
        setError(`${photo.file!.name}: ${apiMessage(cause)}. Повторите сохранение — уже загруженные фото отправлять заново не нужно.`);
        return null;
      }
    }
    return photos.map((photo) => uploaded.current.get(photo.id) ?? photo.preview);
  };

  return { photos, error, add, remove, makeCover, upload };
}

function validatePhoto(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) return "поддерживаются JPG, PNG и WebP";
  if (!file.size) return "файл пуст";
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024)
    return `размер не должен превышать ${MAX_IMAGE_SIZE_MB} MB`;
  return "";
}
