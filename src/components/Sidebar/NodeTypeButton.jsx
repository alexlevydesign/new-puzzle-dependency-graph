import React from 'react';
import './NodeTypeButton.css';

const NodeTypeButton = ({ type, config, onDragStart }) => {
  return (
    <div
      className="node-type-button"
      draggable
      onDragStart={(e) => onDragStart(e, type)}
      style={{ backgroundColor: config.color, border: config.borderColor }}
    >
      <img src={config.icon} alt={config.label} className="node-type-icon" />
      <span className="node-type-label">{config.label}</span>
    </div>
  );
};

export default NodeTypeButton;
