import React, { useState } from 'react';
import './ConnectionLine.css';

const ConnectionLine = ({ from, to, isHighlighted, isTemp, onInsertClick }) => {
  const [isHovering, setIsHovering] = useState(false);
  const startX = from.x;
  const startY = from.y;
  const endX = to.x;
  const endY = to.y;

  // Calculate control points for a smooth cubic bezier curve
  const deltaY = endY - startY;
  const controlPointOffset = Math.max(Math.abs(deltaY) * 0.5, 50);

  const controlPoint1Y = startY + controlPointOffset;
  const controlPoint2Y = endY - controlPointOffset;

  const path = `M ${startX} ${startY} C ${startX} ${controlPoint1Y}, ${endX} ${controlPoint2Y}, ${endX} ${endY}`;

  // Calculate midpoint for the insert button
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  const className = `connection-line ${isHighlighted ? 'highlighted' : ''} ${isTemp ? 'temp' : ''} ${isHovering && !isTemp ? 'hovering' : ''}`;

  const handleMouseEnter = () => {
    if (!isTemp) setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  return (
    <g 
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <path
        d={path}
        className="connection-path-bg"
      />
      <path
        d={path}
        className="connection-path"
      />
      <circle
        cx={endX}
        cy={endY}
        r="4"
        className="connection-arrow"
      />
      
      {isHovering && !isTemp && (
        <g className="connection-insert-button">
          <circle
            cx={midX}
            cy={midY}
            r="16"
            className="insert-button-bg"
          />
          <text
            x={midX}
            y={midY}
            className="insert-button-icon"
            onClick={() => onInsertClick && onInsertClick(midX, midY)}
          >
            +
          </text>
        </g>
      )}
    </g>
  );
};

export default ConnectionLine;
