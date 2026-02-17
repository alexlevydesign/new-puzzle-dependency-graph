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
  onDragStart,
  onDrag,
  onDragEnd,
  onConnectionStart,
  onConnectionDrag,
  onConnectionEnd
}) => {
  const nodeRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const config = NODE_CONFIG[node.type];

  const handleMouseDown = (e) => {
    if (e.target.closest('.node-connection-point')) return;
    
    e.stopPropagation();
    onSelect(node);
    setIsDragging(true);
    
    // Store the offset in canvas coordinate space
    // Account for zoom and pan when calculating the drag start position
    const canvasRect = nodeRef.current.parentElement.parentElement.getBoundingClientRect();
    const canvasX = (e.clientX - canvasRect.left - pan.x) / zoom;
    const canvasY = (e.clientY - canvasRect.top - pan.y) / zoom;
    
    dragStartPos.current = {
      x: canvasX - node.position.x,
      y: canvasY - node.position.y
    };
    onDragStart(node, e);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      // Get the canvas container rect
      const canvasRect = nodeRef.current.parentElement.parentElement.getBoundingClientRect();
      // Transform mouse position from screen space to canvas coordinate space
      const canvasX = (e.clientX - canvasRect.left - pan.x) / zoom;
      const canvasY = (e.clientY - canvasRect.top - pan.y) / zoom;
      
      const newX = canvasX - dragStartPos.current.x;
      const newY = canvasY - dragStartPos.current.y;
      onDrag(node, { x: Math.max(0, newX), y: Math.max(0, newY) });
    } else if (isConnecting) {
      // Get the canvas container rect
      const canvasRect = nodeRef.current.parentElement.parentElement.getBoundingClientRect();
      // Transform mouse position from screen space to canvas coordinate space
      const x = (e.clientX - canvasRect.left - pan.x) / zoom;
      const y = (e.clientY - canvasRect.top - pan.y) / zoom;
      onConnectionDrag({ x, y });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onDragEnd();
    }
    if (isConnecting) {
      setIsConnecting(false);
      onConnectionEnd(null); // Cancel the connection if released outside a target
    }
  };

  React.useEffect(() => {
    if (isDragging || isConnecting) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isConnecting, node.position, zoom, pan]);

  const handleConnectionPointMouseDown = (e, isOutput) => {
    e.stopPropagation();
    
    // Get actual node height from DOM (this will be scaled by zoom)
    const rect = nodeRef.current.getBoundingClientRect();
    // Divide by zoom to get the actual canvas space height
    const nodeHeight = rect.height / zoom;
    
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
      ref={nodeRef}
      data-node-id={node.id}
      className={`graph-node ${isSelected ? 'selected' : ''} ${isCommandPressed ? 'disconnect-mode' : ''} ${isConnecting ? 'connecting' : ''}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        backgroundColor: config.color
      }}
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
  );
};

export default GraphNode;
