// src/components/ConfirmModal.jsx
import React from 'react';
import '../styles/global.css';

const ConfirmModal = ({ show, onHide, title, body, onConfirm, confirmText, cancelText }) => {
  if (!show) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onHide}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ // Added inline styles for better mobile appearance
          maxWidth: '90vw', // Ensure modal doesn't take full screen width on very small devices
          width: 'fit-content', // Adjust width to content, but max 90vw
          padding: '20px',      // Add some padding inside the modal content
          borderRadius: '10px', // Optional: Add rounded corners for better visual appeal
        }}
      >
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