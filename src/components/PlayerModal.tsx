import { useEffect } from 'react';
import type { Stream } from '../data/types';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  stream: Stream;
  onClose: () => void;
}

function embedUrl({ youtube }: Stream) {
  const params = 'autoplay=1&playsinline=1&rel=0';
  return youtube.videoId
    ? `https://www.youtube-nocookie.com/embed/${youtube.videoId}?${params}`
    : `https://www.youtube-nocookie.com/embed/live_stream?channel=${youtube.channelId}&${params}`;
}

function watchUrl({ youtube }: Stream) {
  return youtube.videoId
    ? `https://www.youtube.com/watch?v=${youtube.videoId}`
    : `https://www.youtube.com/channel/${youtube.channelId}/live`;
}

export default function PlayerModal({ stream, onClose }: Props) {
  const { lang, t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={stream.name[lang]}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="player">
          <iframe
            src={embedUrl(stream)}
            title={stream.name[lang]}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
        <div className="modal-footer">
          <div>
            <strong>{stream.name[lang]}</strong>
            <p className="muted">
              {stream.animals[lang]} · {t.source}: {stream.source}
            </p>
            {stream.status && <p className="status-note">{t[`${stream.status}Note`]}</p>}
          </div>
          <div className="modal-actions">
            <a href={watchUrl(stream)} target="_blank" rel="noreferrer">
              {t.openOnYouTube} ↗
            </a>
            <button className="icon-button" onClick={onClose} aria-label={t.close}>
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
