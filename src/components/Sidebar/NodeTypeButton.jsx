import React from 'react';
import './NodeTypeButton.css';

const NodeTypeButton = ({ type, config }) => {
  return (
    <div
      className="node-type-button"
      style={{ backgroundColor: config.color, border: config.borderColor }}
    >
      <img src={config.icon} alt={config.label} className="sidebar-node-type-icon" />
      <span className="node-type-label">{config.label}</span>
    </div>
  );
};

export default NodeTypeButton;
