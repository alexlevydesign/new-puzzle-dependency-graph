import React, { useRef, useState } from 'react';
import './GraphNode.css';
import { NODE_CONFIG, NODE_TYPES } from '../../constants/nodeTypes.jsx';

const GraphNode = ({
  node,
  isSelected,
  isCommandPressed,
  zoom,
  pan,
  onSelect,
  onConnectionStart,
  onConnectionDrag,
  onConnectionEnd,
  onAddBelow,
  onAddBranch
}) => {
  const nodeRef = useRef(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  const config = NODE_CONFIG[node.type];

  // Update refs when zoom or pan changes
  React.useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.node-connection-point')) return;
    e.stopPropagation();
    onSelect(node);
  };

  const handleMouseMove = (e) => {
    if (isConnecting) {
      const canvasRect = nodeRef.current.parentElement.parentElement.getBoundingClientRect();
      const x = (e.clientX - canvasRect.left - panRef.current.x) / zoomRef.current;
      const y = (e.clientY - canvasRect.top - panRef.current.y) / zoomRef.current;
      onConnectionDrag({ x, y });
    }
  };

  const handleMouseUp = (e) => {
    if (isConnecting) {
      setIsConnecting(false);
      const canvasRect = nodeRef.current.parentElement.parentElement.getBoundingClientRect();
      const x = (e.clientX - canvasRect.left - panRef.current.x) / zoomRef.current;
      const y = (e.clientY - canvasRect.top - panRef.current.y) / zoomRef.current;
      onConnectionEnd(null, { x, y });
    }
  };

  React.useEffect(() => {
    if (isConnecting) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isConnecting]);

  const handleConnectionPointMouseDown = (e, isOutput) => {
    e.stopPropagation();
    
    // Get actual node height from DOM (this will be scaled by zoom)
    const rect = nodeRef.current.getBoundingClientRect();
    // Divide by zoom to get the actual canvas space height
    const nodeHeight = rect.height / zoomRef.current;
    
    // Use node position directly (already in canvas coordinates)
    // Add half the node width (100px) to center the connection point horizontally
    const x = node.position.x + 100;
    // For output: add the actual node height, for input: use node.position.y
    const y = isOutput ? node.position.y + nodeHeight : node.position.y;
    
    if (isOutput) {
      // Starting a new connection from output
      setIsConnecting(true);
      onConnectionStart(node.id, { x, y });
    } else {
      // Dragging from input to disconnect - don't set isConnecting
      onConnectionStart(node.id, { x, y }, true); // true indicates this is from input (for disconnect)
    }
  };

  const handleConnectionPointMouseUp = (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Always reset isConnecting when mouseUp on a connection point
    setIsConnecting(false);
    
    // If we're NOT the source node (global isConnecting from another node),
    // then this is the target node
    onConnectionEnd(node.id);
  };

  const handleConnectionPointMouseEnter = (e) => {
    if (isConnecting) {
      // Visual feedback when hovering over a valid target
      e.currentTarget.classList.add('hover');
    }
  };

  const handleConnectionPointMouseLeave = (e) => {
    e.currentTarget.classList.remove('hover');
  };

  return (
    <div
      className="node-wrapper"
      style={{ left: node.position.x, top: node.position.y }}
    >
      {/* Main node card */}
      <div
        ref={nodeRef}
        data-node-id={node.id}
        className={`graph-node ${isSelected ? 'selected' : ''} ${isCommandPressed ? 'disconnect-mode' : ''} ${isConnecting ? 'connecting' : ''}`}
        style={{ backgroundColor: config.color }}
        onMouseDown={handleMouseDown}
      >
        <div
          className="node-connection-point input"
          onMouseDown={(e) => handleConnectionPointMouseDown(e, false)}
          onMouseUp={handleConnectionPointMouseUp}
          onMouseEnter={handleConnectionPointMouseEnter}
          onMouseLeave={handleConnectionPointMouseLeave}
        />

        <div className="node-header">
          <img src={config.icon} alt={config.label} className="node-icon" />
          <span className="node-type-label">{config.label}</span>
        </div>

        <div className="node-content">
          <div className="node-title">{node.title || config.defaultTitle}</div>
          {node.description && (
            <div className="node-description">{node.description}</div>
          )}
          {node.type === NODE_TYPES.GET_ITEM && node.items && node.items.length > 0 && (
            <div className="node-items">
              {node.items.map((item, index) => (
                <span key={index} className="node-item-badge">{item}</span>
              ))}
            </div>
          )}
        </div>

        <div
          className="node-connection-point output"
          onMouseDown={(e) => handleConnectionPointMouseDown(e, true)}
          onMouseUp={handleConnectionPointMouseUp}
          onMouseEnter={handleConnectionPointMouseEnter}
          onMouseLeave={handleConnectionPointMouseLeave}
        />
      </div>

      {/* Hover zone below — shows "add below" button */}
      <div className="node-zone node-zone-below">
        <button
          className="node-action-btn"
          title="Add node below"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onAddBelow(node); }}
        >
          <img src="/icons/add.svg" alt="Add node below" />
        </button>
      </div>

      {/* Hover zone to the right — shows "branch" button */}
      <div className="node-zone node-zone-right">
        <button
          className="node-action-btn node-action-btn--branch"
          title="Add branch right"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onAddBranch(node, 'right'); }}
        >
          <img src="/icons/add.svg" alt="Add branch right" />
        </button>
      </div>

      {/* Hover zone to the left — shows "branch" button */}
      <div className="node-zone node-zone-left">
        <button
          className="node-action-btn node-action-btn--branch"
          title="Add branch left"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onAddBranch(node, 'left'); }}
        >
          <img src="/icons/add.svg" alt="Add branch left" />
        </button>
      </div>
    </div>
  );
};

export default GraphNode;
