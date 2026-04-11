'use client';

interface ErrorMessageProps {
  title?: string;
  message: string;
  retry?: () => void;
}

export function ErrorMessage({ title = 'No pudimos cargar esta seccion', message, retry }: ErrorMessageProps) {
  return (
    <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-100">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-xs font-bold text-rose-200">
          !
        </div>
        <div className="flex-1">
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-rose-100/80">{message}</p>
          {retry ? (
            <button
              type="button"
              onClick={retry}
              className="mt-4 rounded-full border border-rose-300/30 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:border-rose-200/50 hover:bg-rose-500/10"
            >
              Reintentar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
