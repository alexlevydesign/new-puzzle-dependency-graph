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
  onConnectionEnd,
  onShowAddNodeMenu,
  hasOutgoingConnection
}) => {
  const nodeRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isHoveringBelow, setIsHoveringBelow] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const isConnectingRef = useRef(false); // Track connection state synchronously
  
  // Touch tracking for mobile tap detection
  const touchStartRef = useRef(null);
  const isMobileRef = useRef(false);

  const config = NODE_CONFIG[node.type];

  // Update refs when zoom or pan changes
  React.useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  // Keep isConnectingRef in sync with isConnecting state
  React.useEffect(() => {
    isConnectingRef.current = isConnecting;
  }, [isConnecting]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.node-connection-point') || e.target.closest('.node-add-below-zone')) return;
    
    e.stopPropagation();
    onSelect(node);
    setIsDragging(true);
    
    // Store the offset in canvas coordinate space
    // Account for zoom and pan when calculating the drag start position
    const canvasRect = nodeRef.current.parentElement.parentElement.getBoundingClientRect();
    const canvasX = (e.clientX - canvasRect.left - panRef.current.x) / zoomRef.current;
    const canvasY = (e.clientY - canvasRect.top - panRef.current.y) / zoomRef.current;
    
    dragStartPos.current = {
      x: canvasX - node.position.x,
      y: canvasY - node.position.y
    };
    onDragStart(node, e);
  };

  const handleTouchStart = (e) => {
    const connectionPointElement = e.target.closest('.node-connection-point');
    const addBelowElement = e.target.closest('.node-add-below-zone');
    
    // Handle connection point touches
    if (connectionPointElement) {
      e.stopPropagation();
      const isOutput = connectionPointElement.classList.contains('output');
      
      // Get actual node height from DOM (this will be scaled by zoom)
      const rect = nodeRef.current.getBoundingClientRect();
      // Divide by zoom to get the actual canvas space height
      const nodeHeight = rect.height / zoomRef.current;
      
      // Use node position directly (already in canvas coordinates)
      // Add half the node width (100px) to center the connection point horizontally
      const x = node.position.x + 100;
      // For output: add the actual node height, for input: use node.position.y
      const y = isOutput ? node.position.y + nodeHeight : node.position.y;
      
      // Immediately set the ref before state updates
      isConnectingRef.current = true;
      
      if (isOutput) {
        // Starting a new connection from output
        setIsConnecting(true);
        onConnectionStart(node.id, { x, y });
      } else {
        // Starting from input to disconnect
        onConnectionStart(node.id, { x, y }, true); // true indicates this is from input (for disconnect)
      }
      return;
    }
    
    if (addBelowElement) return;
    
    e.stopPropagation();
    
    // Mark that we're on mobile
    isMobileRef.current = true;
    
    // Store the touch start position (we only select if it's a tap, not a drag)
    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
      
      // Start dragging without selecting yet
      setIsDragging(true);
      
      const canvasRect = nodeRef.current.parentElement.parentElement.getBoundingClientRect();
      const canvasX = (touch.clientX - canvasRect.left - panRef.current.x) / zoomRef.current;
      const canvasY = (touch.clientY - canvasRect.top - panRef.current.y) / zoomRef.current;
      
      dragStartPos.current = {
        x: canvasX - node.position.x,
        y: canvasY - node.position.y
      };
      onDragStart(node, e);
    }
  };

  const handleTouchEnd = (e) => {
    // Handle connection completion first
    if (isConnectingRef.current) {
      setIsConnecting(false);
      isConnectingRef.current = false;
      // Don't select the node when completing a connection
      touchStartRef.current = null;
      // Connection completion will be handled by Canvas handleTouchEnd
      return;
    }
    
    if (!touchStartRef.current || !isMobileRef.current) return;
    
    e.stopPropagation();
    
    const touch = e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0] : null;
    if (!touch) return;
    
    const touchEnd = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    
    // Calculate distance moved
    const dx = Math.abs(touchEnd.x - touchStartRef.current.x);
    const dy = Math.abs(touchEnd.y - touchStartRef.current.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If the touch moved less than 10px and lasted less than 300ms, treat it as a tap
    const isTap = distance < 10 && (touchEnd.time - touchStartRef.current.time) < 300;
    
    // Only select the node if this was a tap (not a drag)
    if (isTap) {
      onSelect(node);
    }
    
    setIsDragging(false);
    onDragEnd();
    touchStartRef.current = null;
  };

  const handleTouchMove = (e) => {
    // Handle connection dragging on touch
    if (isConnectingRef.current) {
      e.preventDefault();
      const touch = e.touches && e.touches.length > 0 ? e.touches[0] : null;
      if (!touch) return;
      
      const canvasRect = nodeRef.current.parentElement.parentElement.getBoundingClientRect();
      const canvasX = (touch.clientX - canvasRect.left - panRef.current.x) / zoomRef.current;
      const canvasY = (touch.clientY - canvasRect.top - panRef.current.y) / zoomRef.current;
      onConnectionDrag({ x: canvasX, y: canvasY });
      return;
    }
    
    if (!isDragging) return;
    
    // Handle touch move for dragging
    const touch = e.touches && e.touches.length > 0 ? e.touches[0] : null;
    if (!touch) return;
    
    const canvasRect = nodeRef.current.parentElement.parentElement.getBoundingClientRect();
    const canvasX = (touch.clientX - canvasRect.left - panRef.current.x) / zoomRef.current;
    const canvasY = (touch.clientY - canvasRect.top - panRef.current.y) / zoomRef.current;
    
    const newX = canvasX - dragStartPos.current.x;
    const newY = canvasY - dragStartPos.current.y;
    onDrag(node, { x: Math.max(0, newX), y: Math.max(0, newY) });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      // Get the canvas container rect
      const canvasRect = nodeRef.current.parentElement.parentElement.getBoundingClientRect();
      // Transform mouse position from screen space to canvas coordinate space
      const canvasX = (e.clientX - canvasRect.left - panRef.current.x) / zoomRef.current;
      const canvasY = (e.clientY - canvasRect.top - panRef.current.y) / zoomRef.current;
      
      const newX = canvasX - dragStartPos.current.x;
      const newY = canvasY - dragStartPos.current.y;
      onDrag(node, { x: Math.max(0, newX), y: Math.max(0, newY) });
    } else if (isConnecting) {
      // Get the canvas container rect
      const canvasRect = nodeRef.current.parentElement.parentElement.getBoundingClientRect();
      // Transform mouse position from screen space to canvas coordinate space
      const x = (e.clientX - canvasRect.left - panRef.current.x) / zoomRef.current;
      const y = (e.clientY - canvasRect.top - panRef.current.y) / zoomRef.current;
      onConnectionDrag({ x, y });
    }
  };

  const handleMouseUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      onDragEnd();
    }
    if (isConnecting) {
      setIsConnecting(false);
      // Get the final mouse position for context menu
      const canvasRect = nodeRef.current.parentElement.parentElement.getBoundingClientRect();
      const x = (e.clientX - canvasRect.left - panRef.current.x) / zoomRef.current;
      const y = (e.clientY - canvasRect.top - panRef.current.y) / zoomRef.current;
      onConnectionEnd(null, { x, y }); // Pass the release position
    }
  };

  React.useEffect(() => {
    if (isDragging || isConnecting) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd, { passive: false });
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, isConnecting]);

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

  const handleBelowMouseEnter = () => {
    setIsHoveringBelow(true);
  };

  const handleBelowMouseLeave = () => {
    setIsHoveringBelow(false);
  };

  const handleAddNodeBelowClick = (e) => {
    e.stopPropagation();
    const button = e.target.closest('.node-add-below-button');
    // Show the menu at the button's position and pass the origin node
    if (onShowAddNodeMenu && button) {
      const rect = button.getBoundingClientRect();
      onShowAddNodeMenu(node, rect);
    }
  };

  return (
    <div
      ref={nodeRef}
      data-node-id={node.id}
      className={`graph-node ${node.type} ${isSelected ? 'selected' : ''} ${isCommandPressed ? 'disconnect-mode' : ''} ${isConnecting ? 'connecting' : ''}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        backgroundColor: config.color,
        border: config.borderColor
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="node-connection-point input"
        onMouseDown={(e) => handleConnectionPointMouseDown(e, false)}
        onMouseUp={handleConnectionPointMouseUp}
        onMouseEnter={handleConnectionPointMouseEnter}
        onMouseLeave={handleConnectionPointMouseLeave}
        onTouchEnd={handleConnectionPointMouseUp}
      />
      
      <div className="node-header">
        <div className="node-icon-container" style={
          { border: config.borderColor, backgroundColor: config.color }
          
          }>
        <img src={config.icon} alt={config.label} className="node-icon" />
        </div>
      </div>
      
      <div className="node-content">
        <div className="node-type-label-above">{config.label}</div>
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
        onTouchEnd={handleConnectionPointMouseUp}
      />

      {!hasOutgoingConnection && (
        <div
          className="node-add-below-zone"
          onMouseEnter={handleBelowMouseEnter}
          onMouseLeave={handleBelowMouseLeave}
        >
          {isHoveringBelow && (
            <button
              className="node-add-below-button"
              onClick={handleAddNodeBelowClick}
              title="Add node below"
            >
              +
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GraphNode;
