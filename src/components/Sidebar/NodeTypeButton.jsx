import React, { useState } from 'react';
import './NodeTypeButton.css';

const NodeTypeButton = ({ type, config, onDragStart }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e) => {
    setIsDragging(true);
    onDragStart(e, type);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="node-type-button"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{ 
        backgroundColor: config.color, 
        border: config.borderColor,
        opacity: isDragging ? 0.5 : 1
      }}
    >
      <img src={config.icon} alt={config.label} className="sidebar-node-type-icon" />
      <span className="node-type-label">{config.label}</span>
    </div>
  );
};

export default NodeTypeButton;
