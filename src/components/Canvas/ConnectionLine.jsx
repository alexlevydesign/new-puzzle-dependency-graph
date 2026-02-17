import React from 'react';
import './ConnectionLine.css';

const ConnectionLine = ({ from, to, isHighlighted, isTemp }) => {
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

  const className = `connection-line ${isHighlighted ? 'highlighted' : ''} ${isTemp ? 'temp' : ''}`;

  return (
    <g className={className}>
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
    </g>
  );
};

export default ConnectionLine;
