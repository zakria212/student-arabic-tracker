import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';

export type ViewerImage = { url: string; name: string };

/** عارض صور بملء الشاشة مع تكبير، يُغلق ويعيد المستخدم إلى التفاصيل دون فقد الموضع */
export function ImageViewer({ images, index, onClose, onIndex }: { images: ViewerImage[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(false);
  const img = images[index];

  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => setZoom(false), [index]);

  const go = (d: number) => onIndex((index + d + images.length) % images.length);

  return (
    <dialog
      ref={ref}
      aria-label={`عرض المرفق ${img?.name ?? ''}`}
      className="m-0 h-[100dvh] max-h-none w-screen max-w-none bg-black/95 p-0 text-white"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(1);
        if (e.key === 'ArrowRight') go(-1);
      }}
    >
      <div className="flex h-full flex-col" dir="rtl">
        <div className="flex items-center justify-between gap-2 p-3">
          <span className="truncate text-sm opacity-80">{img?.name} {images.length > 1 && `(${index + 1}/${images.length})`}</span>
          <div className="flex gap-1">
            <button className="rounded-full p-2.5 hover:bg-white/10" onClick={() => setZoom((z) => !z)} aria-label={zoom ? 'تصغير' : 'تكبير'}>
              {zoom ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
            </button>
            <button className="rounded-full p-2.5 hover:bg-white/10" onClick={onClose} aria-label="إغلاق العارض">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className={`relative flex-1 ${zoom ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden'}`}>
          {img && (
            <img
              src={img.url}
              alt={img.name}
              onClick={() => setZoom((z) => !z)}
              className={zoom ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain'}
              style={zoom ? { width: '200%' } : undefined}
            />
          )}
          {images.length > 1 && !zoom && (
            <>
              <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20" onClick={() => go(-1)} aria-label="الصورة السابقة">
                <ChevronRight className="h-6 w-6" />
              </button>
              <button className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20" onClick={() => go(1)} aria-label="الصورة التالية">
                <ChevronLeft className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
