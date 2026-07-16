"use client";

export default function BottomSheet({ open, onClose, children }) {
  if (!open) return null;
  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-handle" onClick={onClose} />
        {children}
      </div>
    </>
  );
}
