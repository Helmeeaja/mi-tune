import { useTranslation } from "../lib/i18n.jsx";
import { useLayoutEffect, useRef, useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { motionTokens } from '../lib/motion.js';
export default function Modal({
  title,
  children,
  onClose
}) {
  const {
    t,
    locale
  } = useTranslation();
  const reference = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const heading = useId();
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const element = reference.current;
    const previousFocus = document.activeElement;
    element.showModal();
    window.dispatchEvent(new Event('mi-tune:dialog'));
    const cancel = event => {
      event.preventDefault();
      close.current();
    };
    const trapFocus = event => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
      const controls = [...element.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter(control => control.tabIndex >= 0 && !control.disabled && control.getClientRects().length);
      if (!controls.length) {
        event.preventDefault();
        element.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      const inside = element.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    element.addEventListener('cancel', cancel);
    element.addEventListener('keydown', trapFocus);
    return () => {
      element.removeEventListener('cancel', cancel);
      element.removeEventListener('keydown', trapFocus);
      element.close();
      window.dispatchEvent(new Event('mi-tune:dialog'));
      if (previousFocus?.isConnected) previousFocus.focus({
        preventScroll: true
      });
    };
  }, []);
  return <dialog ref={reference} aria-labelledby={heading} data-lenis-prevent className="modal-shell m-auto max-h-[88dvh] w-[calc(100%_-_32px)] max-w-md overflow-y-auto p-6 sm:p-7" onClick={event => {
    if (event.target === reference.current) onClose();
  }}>
    <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} transition={{
      duration: motionTokens.duration.fast
    }}>
      <div className="mb-6 flex items-start justify-between gap-3"><div><p className="eyebrow mb-2">{t("Mi Tune")}</p><h2 id={heading} className="text-2xl font-extrabold tracking-[-.04em]">{title}</h2></div><motion.button type="button" aria-label={t("Tutup dialog")} whileTap={reduced ? undefined : {
          scale: motionTokens.scale.press
        }} onClick={onClose} className="icon-button -mr-2 -mt-1"><X size={20} /></motion.button></div>
      {children}
    </motion.div>
  </dialog>;
}
