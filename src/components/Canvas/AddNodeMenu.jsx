import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './AddNodeMenu.css';
import { NODE_CONFIG, NODE_TYPES } from '../../constants/nodeTypes.jsx';

const AddNodeMenu = ({ position, onSelectNodeType, onClose }) => {
  const menuRef = useRef(null);
  const nodeTypesList = Object.values(NODE_TYPES);
  const [adjustedPosition, setAdjustedPosition] = useState({ left: position.x, top: position.y, opacity: 0 });

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const padding = 10;
      
      let newLeft = position.x;
      let newTop = position.y;

      if (position.x + rect.width + padding > window.innerWidth) {
        newLeft = window.innerWidth - rect.width - padding;
      }
      if (position.x < padding) {
        newLeft = padding;
      }

      if (position.y + rect.height + padding > window.innerHeight) {
        newTop = position.y - rect.height - 40; // open above the button instead
      }
      if (newTop < padding) {
        newTop = padding;
      }

      setAdjustedPosition({ left: newLeft, top: newTop, opacity: 1 });
    }
  }, [position]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleMenuItemClick = (nodeType) => {
    onSelectNodeType(nodeType);
    onClose();
  };

  const handleMenuMouseDown = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      ref={menuRef}
      className="add-node-menu"
      style={{
        left: adjustedPosition.left,
        top: adjustedPosition.top,
        opacity: adjustedPosition.opacity
      }}
      onMouseDown={handleMenuMouseDown}
    >
      {nodeTypesList.map((nodeType, index) => {
        const config = NODE_CONFIG[nodeType];
        // Ensure border is correctly applied (borderColor in config typically contains 'solid 1px' but just in case)
        const borderStyle = config.borderColor.includes('solid') ? config.borderColor : `1px solid ${config.borderColor}`;
        // To avoid double border on bottom and top of adjacents, 
        // we omit borderBottom for all but the last item, OR omit borderTop for all but first.
        // Actually, it's easier to just use standard border and margin-top: -1px in CSS.
        
        return (
          <div
            key={nodeType}
            className="add-node-menu-item"
            style={{ '--hover-bg': config.color }}
            onClick={() => handleMenuItemClick(nodeType)}
          >
            <div
              className="menu-item-icon-container"
              style={{ 
                backgroundColor: config.color, 
                borderTop: index === 0 ? borderStyle : 'none',
                borderBottom: borderStyle,
                borderRight: borderStyle
              }}
            >
              <img src={config.icon} alt={config.label} className="menu-item-icon" />
            </div>
            <div className="menu-item-label">{config.label}</div>
          </div>
        );
      })}
    </div>
  );
};

export default AddNodeMenu;
