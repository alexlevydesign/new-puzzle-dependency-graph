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
  onUpdateNode
}) => {
  const nodeRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const titleInputRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
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
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
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

  const handleTitleDoubleClick = (e) => {
    e.stopPropagation();
    setEditingTitle(node.title || config.defaultTitle);
    setIsEditingTitle(true);
    // Focus the input on next render
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleTitleInputChange = (e) => {
    setEditingTitle(e.target.value);
  };

  const commitTitleEdit = () => {
    const trimmed = editingTitle.trim();
    if (trimmed && trimmed !== (node.title || config.defaultTitle)) {
      onUpdateNode(node.id, { title: trimmed });
    }
    setIsEditingTitle(false);
  };

  const handleTitleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTitleEdit();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const handleTitleInputBlur = () => {
    commitTitleEdit();
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
        <div className="node-type-label-above">{config.label}</div>
        <div className="node-title" onDoubleClick={handleTitleDoubleClick}>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              className="node-title-input"
              value={editingTitle}
              onChange={handleTitleInputChange}
              onKeyDown={handleTitleInputKeyDown}
              onBlur={handleTitleInputBlur}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            node.title || config.defaultTitle
          )}
        </div>
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
