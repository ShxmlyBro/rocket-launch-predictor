import React from "react";
import { FiAlertTriangle, FiCheckCircle, FiDatabase, FiHelpCircle } from "react-icons/fi";

const KINDS = {
  flagged: { Icon: FiAlertTriangle, label: "Flagged" },
  clear: { Icon: FiCheckCircle, label: "Not flagged" },
  low: { Icon: FiHelpCircle, label: "Low confidence" },
  sample: { Icon: FiDatabase, label: "Sample data" },
};

export default function StatusPill({ kind }) {
  const { Icon, label } = KINDS[kind];
  return (
    <span className={`status-pill ${kind}`}>
      <Icon aria-hidden="true" /> {label}
    </span>
  );
}
