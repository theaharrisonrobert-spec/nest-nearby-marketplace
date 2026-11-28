import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Film } from "lucide-react";

export type ListingMediaItem = {
  id: string;
  media_url: string;
  media_type: "photo" | "video";
  sort_order: number;
};

type Props = {
  media?: ListingMediaItem[] | null;
  fallbackUrl: string;
  title: string;
  compact?: boolean;
};

export function ListingMediaGallery({ media, fallbackUrl, title, compact = false }: Props) {
  const items: ListingMediaItem[] = media?.length ? media : [{ id: "legacy-image", media_url: fallbackUrl, media_type: "photo", sort_order: 0 }];
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [items.map((item) => item.id).join("|")]);
  const item = items[Math.min(active, items.length - 1)] ?? items[0]!;
  const frame = compact ? "aspect-[16/10]" : "aspect-[16/10] min-h-48";
  return (
    <div className="w-full">
      <div className={`group relative overflow-hidden rounded-xl bg-muted ${frame}`}>
        {item.media_type === "video" ? (
          <video key={item.id} src={item.media_url} controls playsInline preload="metadata" aria-label={`${title} video`} className="h-full w-full object-contain" />
        ) : (
          <img key={item.id} src={item.media_url} alt={`${title} photo ${active + 1}`} loading="lazy" className="h-full w-full object-cover" />
        )}
        {items.length > 1 && (
          <>
            <button type="button" onClick={() => setActive((active - 1 + items.length) % items.length)} aria-label="Previous property media" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow hover:bg-black/80"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => setActive((active + 1) % items.length)} aria-label="Next property media" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow hover:bg-black/80"><ChevronRight className="h-5 w-5" /></button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-1 text-xs font-medium text-white">{active + 1} / {items.length}</span>
          </>
        )}
      </div>
      {items.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Property gallery thumbnails">
          {items.map((mediaItem, index) => (
            <button key={mediaItem.id} type="button" onClick={() => setActive(index)} aria-label={mediaItem.media_type === "video" ? "Show property video" : `Show photo ${index + 1}`} aria-pressed={index === active} className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 ${index === active ? "border-primary" : "border-transparent"}`}>
              {mediaItem.media_type === "video" ? <span className="flex h-full w-full items-center justify-center bg-ink text-white"><Film className="h-5 w-5" /></span> : <img src={mediaItem.media_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}