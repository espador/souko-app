// src/components/ConfirmModal.jsx
import React from 'react';
import '../styles/global.css';
import '../styles/components//ConfirmModal.css'; // Make sure to import your CSS

const ConfirmModal = ({ show, onHide, title, body, onConfirm, confirmText, cancelText }) => {
  if (!show) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onHide}> {/* The overlay */}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}> {/* Prevents closing when clicking inside */}
        <h2 className="modal-title">{title}</h2>
        <div className="modal-body">
          <p>{body}</p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onHide}>{cancelText}</button>
          <button className="btn-primary" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;