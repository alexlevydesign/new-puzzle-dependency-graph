import React, { useState } from 'react';
import './ConnectionLine.css';

const ConnectionLine = ({ from, to, isHighlighted, isTemp, onAddBetween }) => {
  const [hovered, setHovered] = useState(false);

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

  // Midpoint along the bezier curve (t=0.5)
  const midX = 0.125 * startX + 0.375 * startX + 0.375 * endX + 0.125 * endX;
  const midY = 0.125 * startY
    + 0.375 * controlPoint1Y
    + 0.375 * controlPoint2Y
    + 0.125 * endY;

  const className = `connection-line ${isHighlighted ? 'highlighted' : ''} ${isTemp ? 'temp' : ''} ${hovered ? 'hovered' : ''}`;
  const btnSize = 20;

  return (
    <g
      className={className}
      onMouseEnter={() => !isTemp && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <path d={path} className="connection-path-bg" />
      <path d={path} className="connection-path" />
      <circle cx={endX} cy={endY} r="4" className="connection-arrow" />

      {/* Plus button at midpoint — only on real connections when hovered */}
      {!isTemp && onAddBetween && hovered && (
        <foreignObject
          x={midX - btnSize / 2}
          y={midY - btnSize / 2}
          width={btnSize}
          height={btnSize}
          style={{ overflow: 'visible' }}
        >
          <button
            className="connection-add-btn"
            title="Insert node"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onAddBetween(); }}
          >
            +
          </button>
        </foreignObject>
      )}
    </g>
  );
};

export default ConnectionLine;
